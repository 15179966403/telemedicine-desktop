// 安全服务测试

#[cfg(test)]
mod security_service_tests {
    use super::super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_encrypt_decrypt_cycle() {
        let service = SecurityService::new(300);
        let original = "患者姓名：张三，身份证号：123456789012345678";

        let encrypted = service.encrypt_sensitive_data(original).unwrap();
        assert_ne!(encrypted, original);

        let decrypted = service.decrypt_sensitive_data(&encrypted).unwrap();
        assert_eq!(decrypted, original);
    }

    #[tokio::test]
    async fn test_audit_log_creation() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001".to_string();

        let log_id = service
            .log_audit(
                user_id.clone(),
                AuditAction::ViewPatient,
                Some("patient".to_string()),
                Some("patient_123".to_string()),
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        assert!(!log_id.is_empty());

        let logs = service
            .get_audit_logs(Some(user_id), None, None, None, 10)
            .await
            .unwrap();

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].id, log_id);
        assert!(matches!(logs[0].action, AuditAction::ViewPatient));
    }

    #[tokio::test]
    async fn test_audit_log_filtering() {
        let service = SecurityService::new(300);
        let user1 = "doctor_001".to_string();
        let user2 = "doctor_002".to_string();

        // 创建多个日志
        service
            .log_audit(
                user1.clone(),
                AuditAction::Login,
                None,
                None,
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        service
            .log_audit(
                user2.clone(),
                AuditAction::Login,
                None,
                None,
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        service
            .log_audit(
                user1.clone(),
                AuditAction::ViewPatient,
                None,
                None,
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        // 按用户过滤
        let user1_logs = service
            .get_audit_logs(Some(user1.clone()), None, None, None, 10)
            .await
            .unwrap();
        assert_eq!(user1_logs.len(), 2);

        // 按操作类型过滤
        let login_logs = service
            .get_audit_logs(None, Some(AuditAction::Login), None, None, 10)
            .await
            .unwrap();
        assert_eq!(login_logs.len(), 2);
    }

    #[tokio::test]
    async fn test_failed_login_tracking() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001";

        // 记录多次失败登录
        for _ in 0..5 {
            service.record_failed_login(user_id).await;
        }

        let anomalies = service.detect_anomalies(user_id).await.unwrap();
        assert!(!anomalies.is_empty());

        let failed_login_anomaly = anomalies
            .iter()
            .find(|a| matches!(a.anomaly_type, AnomalyType::MultipleFailedLogins));
        assert!(failed_login_anomaly.is_some());

        // 重置失败计数
        service.reset_failed_login(user_id).await;

        // 再次检测应该没有异常
        let anomalies_after_reset = service.detect_anomalies(user_id).await.unwrap();
        let failed_login_after = anomalies_after_reset
            .iter()
            .find(|a| matches!(a.anomaly_type, AnomalyType::MultipleFailedLogins));
        assert!(failed_login_after.is_none());
    }

    #[tokio::test]
    async fn test_rapid_access_detection() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001";

        // 模拟快速访问（超过50次）
        for _ in 0..60 {
            service
                .log_audit(
                    user_id.to_string(),
                    AuditAction::ViewPatient,
                    None,
                    None,
                    "success".to_string(),
                    None,
                    HashMap::new(),
                )
                .await
                .unwrap();
        }

        let anomalies = service.detect_anomalies(user_id).await.unwrap();
        assert!(!anomalies.is_empty());

        let rapid_access_anomaly = anomalies
            .iter()
            .find(|a| matches!(a.anomaly_type, AnomalyType::RapidDataAccess));
        assert!(rapid_access_anomaly.is_some());
        assert_eq!(rapid_access_anomaly.unwrap().severity, "high");
    }

    #[tokio::test]
    async fn test_auto_lock_timeout() {
        let service = SecurityService::new(2); // 2秒超时
        let user_id = "doctor_001";

        // 记录活动
        service
            .log_audit(
                user_id.to_string(),
                AuditAction::Login,
                None,
                None,
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        // 立即检查，不应该锁定
        assert!(!service.should_auto_lock(user_id).await);

        // 获取最后活动时间
        let last_activity = service.get_last_activity(user_id).await;
        assert!(last_activity.is_some());

        // 等待超时
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

        // 现在应该锁定
        assert!(service.should_auto_lock(user_id).await);
    }

    #[tokio::test]
    async fn test_anomaly_resolution() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001";

        // 创建异常
        for _ in 0..5 {
            service.record_failed_login(user_id).await;
        }

        let anomalies = service.detect_anomalies(user_id).await.unwrap();
        assert!(!anomalies.is_empty());

        let anomaly_id = anomalies[0].id.clone();

        // 标记为已解决
        service.resolve_anomaly(&anomaly_id).await.unwrap();

        // 获取已解决的异常
        let resolved_anomalies = service
            .get_anomaly_records(Some(user_id.to_string()), Some(true))
            .await
            .unwrap();
        assert!(!resolved_anomalies.is_empty());
        assert!(resolved_anomalies[0].resolved);
    }

    #[tokio::test]
    async fn test_cleanup_old_records() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001";

        // 创建一些日志
        for _ in 0..10 {
            service
                .log_audit(
                    user_id.to_string(),
                    AuditAction::ViewPatient,
                    None,
                    None,
                    "success".to_string(),
                    None,
                    HashMap::new(),
                )
                .await
                .unwrap();
        }

        let logs_before = service
            .get_audit_logs(None, None, None, None, 100)
            .await
            .unwrap();
        assert_eq!(logs_before.len(), 10);

        // 清理0天前的记录（应该清理所有）
        service.cleanup_old_records(0).await.unwrap();

        let logs_after = service
            .get_audit_logs(None, None, None, None, 100)
            .await
            .unwrap();
        assert_eq!(logs_after.len(), 0);
    }

    #[tokio::test]
    async fn test_session_activity_tracking() {
        let service = SecurityService::new(300);
        let user_id = "doctor_001";

        // 记录多次活动
        for i in 0..5 {
            service
                .log_audit(
                    user_id.to_string(),
                    AuditAction::ViewPatient,
                    Some("patient".to_string()),
                    Some(format!("patient_{}", i)),
                    "success".to_string(),
                    None,
                    HashMap::new(),
                )
                .await
                .unwrap();
        }

        // 验证活动被跟踪
        let last_activity = service.get_last_activity(user_id).await;
        assert!(last_activity.is_some());
    }

    #[tokio::test]
    async fn test_multiple_users_isolation() {
        let service = SecurityService::new(300);
        let user1 = "doctor_001";
        let user2 = "doctor_002";

        // 用户1失败登录
        for _ in 0..5 {
            service.record_failed_login(user1).await;
        }

        // 用户2正常活动
        service
            .log_audit(
                user2.to_string(),
                AuditAction::Login,
                None,
                None,
                "success".to_string(),
                None,
                HashMap::new(),
            )
            .await
            .unwrap();

        // 检测用户1的异常
        let user1_anomalies = service.detect_anomalies(user1).await.unwrap();
        assert!(!user1_anomalies.is_empty());

        // 检测用户2应该没有异常
        let user2_anomalies = service.detect_anomalies(user2).await.unwrap();
        assert!(user2_anomalies.is_empty());
    }
}
