use rusqlite::{Connection, Result};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// 查询性能统计
#[derive(Debug, Clone)]
pub struct QueryStats {
    pub query: String,
    pub execution_count: u64,
    pub total_duration: Duration,
    pub avg_duration: Duration,
    pub min_duration: Duration,
    pub max_duration: Duration,
}

/// 查询优化器
/// 用于监控和优化数据库查询性能
pub struct QueryOptimizer {
    stats: Arc<Mutex<HashMap<String, QueryStats>>>,
    slow_query_threshold: Duration,
}

impl QueryOptimizer {
    pub fn new(slow_query_threshold_ms: u64) -> Self {
        Self {
            stats: Arc::new(Mutex::new(HashMap::new())),
            slow_query_threshold: Duration::from_millis(slow_query_threshold_ms),
        }
    }

    /// 执行查询并记录性能
    pub fn execute_query<F, T>(&self, query_name: &str, query: F) -> Result<T>
    where
        F: FnOnce() -> Result<T>,
    {
        let start = Instant::now();
        let result = query();
        let duration = start.elapsed();

        self.record_query(query_name, duration);

        if duration > self.slow_query_threshold {
            log::warn!(
                "慢查询检测: {} 耗时 {:?}",
                query_name,
                duration
            );
        }

        result
    }

    /// 记录查询统计
    fn record_query(&self, query_name: &str, duration: Duration) {
        let mut stats = self.stats.lock().unwrap();

        stats
            .entry(query_name.to_string())
            .and_modify(|s| {
                s.execution_count += 1;
                s.total_duration += duration;
                s.avg_duration = s.total_duration / s.execution_count as u32;
                s.min_duration = s.min_duration.min(duration);
                s.max_duration = s.max_duration.max(duration);
            })
            .or_insert_with(|| QueryStats {
                query: query_name.to_string(),
                execution_count: 1,
                total_duration: duration,
                avg_duration: duration,
                min_duration: duration,
                max_duration: duration,
            });
    }

    /// 获取查询统计信息
    pub fn get_stats(&self, query_name: &str) -> Option<QueryStats> {
        let stats = self.stats.lock().unwrap();
        stats.get(query_name).cloned()
    }

    /// 获取所有查询统计
    pub fn get_all_stats(&self) -> Vec<QueryStats> {
        let stats = self.stats.lock().unwrap();
        stats.values().cloned().collect()
    }

    /// 获取慢查询列表
    pub fn get_slow_queries(&self) -> Vec<QueryStats> {
        let stats = self.stats.lock().unwrap();
        stats
            .values()
            .filter(|s| s.avg_duration > self.slow_query_threshold)
            .cloned()
            .collect()
    }

    /// 清除统计信息
    pub fn clear_stats(&self) {
        let mut stats = self.stats.lock().unwrap();
        stats.clear();
    }
}

/// 数据库连接池配置
#[derive(Debug, Clone)]
pub struct PoolConfig {
    pub max_connections: u32,
    pub min_connections: u32,
    pub connection_timeout: Duration,
    pub idle_timeout: Duration,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_connections: 10,
            min_connections: 2,
            connection_timeout: Duration::from_secs(30),
            idle_timeout: Duration::from_secs(600),
        }
    }
}

/// 查询缓存
pub struct QueryCache {
    cache: Arc<Mutex<HashMap<String, (String, Instant)>>>,
    ttl: Duration,
    max_size: usize,
}

impl QueryCache {
    pub fn new(ttl_seconds: u64, max_size: usize) -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            ttl: Duration::from_secs(ttl_seconds),
            max_size,
        }
    }

    /// 获取缓存
    pub fn get(&self, key: &str) -> Option<String> {
        let mut cache = self.cache.lock().unwrap();

        if let Some((value, timestamp)) = cache.get(key) {
            if timestamp.elapsed() < self.ttl {
                return Some(value.clone());
            } else {
                cache.remove(key);
            }
        }

        None
    }

    /// 设置缓存
    pub fn set(&self, key: String, value: String) {
        let mut cache = self.cache.lock().unwrap();

        // 如果缓存已满，移除最旧的项
        if cache.len() >= self.max_size {
            if let Some(oldest_key) = cache
                .iter()
                .min_by_key(|(_, (_, timestamp))| timestamp)
                .map(|(k, _)| k.clone())
            {
                cache.remove(&oldest_key);
            }
        }

        cache.insert(key, (value, Instant::now()));
    }

    /// 清除缓存
    pub fn clear(&self) {
        let mut cache = self.cache.lock().unwrap();
        cache.clear();
    }

    /// 清除过期缓存
    pub fn clear_expired(&self) {
        let mut cache = self.cache.lock().unwrap();
        let now = Instant::now();

        cache.retain(|_, (_, timestamp)| now.duration_since(*timestamp) < self.ttl);
    }
}

/// 批量操作助手
pub struct BatchOperations;

impl BatchOperations {
    /// 批量插入
    pub fn batch_insert<T, F>(
        conn: &Connection,
        items: &[T],
        batch_size: usize,
        insert_fn: F,
    ) -> Result<()>
    where
        F: Fn(&Connection, &[T]) -> Result<()>,
    {
        for chunk in items.chunks(batch_size) {
            let tx = conn.unchecked_transaction()?;
            insert_fn(&tx, chunk)?;
            tx.commit()?;
        }
        Ok(())
    }

    /// 批量更新
    pub fn batch_update<T, F>(
        conn: &Connection,
        items: &[T],
        batch_size: usize,
        update_fn: F,
    ) -> Result<()>
    where
        F: Fn(&Connection, &[T]) -> Result<()>,
    {
        for chunk in items.chunks(batch_size) {
            let tx = conn.unchecked_transaction()?;
            update_fn(&tx, chunk)?;
            tx.commit()?;
        }
        Ok(())
    }
}

/// 索引建议器
pub struct IndexAdvisor;

impl IndexAdvisor {
    /// 分析查询并建议索引
    pub fn analyze_query(query: &str) -> Vec<String> {
        let mut suggestions = Vec::new();

        // 简单的启发式分析
        if query.contains("WHERE") {
            suggestions.push("考虑在WHERE子句中的列上创建索引".to_string());
        }

        if query.contains("JOIN") {
            suggestions.push("考虑在JOIN条件的列上创建索引".to_string());
        }

        if query.contains("ORDER BY") {
            suggestions.push("考虑在ORDER BY的列上创建索引".to_string());
        }

        suggestions
    }

    /// 检查表是否有索引
    pub fn check_indexes(conn: &Connection, table_name: &str) -> Result<Vec<String>> {
        let mut stmt = conn.prepare(&format!(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='{}'",
            table_name
        ))?;

        let indexes = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;

        Ok(indexes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_optimizer() {
        let optimizer = QueryOptimizer::new(100);

        // 模拟查询
        let result = optimizer.execute_query("test_query", || {
            std::thread::sleep(Duration::from_millis(50));
            Ok(())
        });

        assert!(result.is_ok());

        let stats = optimizer.get_stats("test_query");
        assert!(stats.is_some());

        let stats = stats.unwrap();
        assert_eq!(stats.execution_count, 1);
    }

    #[test]
    fn test_query_cache() {
        let cache = QueryCache::new(60, 100);

        cache.set("key1".to_string(), "value1".to_string());
        assert_eq!(cache.get("key1"), Some("value1".to_string()));

        assert_eq!(cache.get("key2"), None);
    }
}
