// 验证工具

use regex::Regex;
use anyhow::Result;

pub struct ValidationService;

impl ValidationService {
    pub fn validate_phone(phone: &str) -> bool {
        let phone_regex = Regex::new(r"^1[3-9]\d{9}$").unwrap();
        phone_regex.is_match(phone)
    }

    pub fn validate_email(email: &str) -> bool {
        let email_regex = Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").unwrap();
        email_regex.is_match(email)
    }

    pub fn validate_id_card(id_card: &str) -> bool {
        let id_regex = Regex::new(r"(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)").unwrap();
        id_regex.is_match(id_card)
    }

    pub fn validate_username(username: &str) -> Result<()> {
        if username.is_empty() {
            return Err(anyhow::anyhow!("用户名不能为空"));
        }

        if username.len() < 3 {
            return Err(anyhow::anyhow!("用户名长度至少3位"));
        }

        if username.len() > 20 {
            return Err(anyhow::anyhow!("用户名长度不能超过20位"));
        }

        let username_regex = Regex::new(r"^[a-zA-Z0-9_]+$").unwrap();
        if !username_regex.is_match(username) {
            return Err(anyhow::anyhow!("用户名只能包含字母、数字和下划线"));
        }

        Ok(())
    }

    pub fn validate_password(password: &str) -> Result<()> {
        if password.len() < 8 {
            return Err(anyhow::anyhow!("密码长度至少8位"));
        }

        if password.len() > 128 {
            return Err(anyhow::anyhow!("密码长度不能超过128位"));
        }

        let has_lowercase = Regex::new(r"[a-z]").unwrap().is_match(password);
        let has_uppercase = Regex::new(r"[A-Z]").unwrap().is_match(password);
        let has_digit = Regex::new(r"\d").unwrap().is_match(password);
        let has_special = Regex::new(r"[!@#$%^&*(),.?\":{}|<>]").unwrap().is_match(password);

        let strength_count = [has_lowercase, has_uppercase, has_digit, has_special]
            .iter()
            .filter(|&&x| x)
            .count();

        if strength_count < 3 {
            return Err(anyhow::anyhow!("密码必须包含至少3种字符类型（大写字母、小写字母、数字、特殊字符）"));
        }

        Ok(())
    }

    pub fn validate_chinese_name(name: &str) -> bool {
        let chinese_name_regex = Regex::new(r"^[\u4e00-\u9fa5]{2,10}$").unwrap();
        chinese_name_regex.is_match(name)
    }

    pub fn validate_doctor_license(license: &str) -> bool {
        let license_regex = Regex::new(r"^\d{15}$").unwrap();
        license_regex.is_match(license)
    }

    pub fn validate_hospital_code(code: &str) -> bool {
        let code_regex = Regex::new(r"^[A-Z0-9]{8,12}$").unwrap();
        code_regex.is_match(code)
    }

    pub fn validate_message_content(content: &str, max_length: usize) -> Result<()> {
        if content.trim().is_empty() {
            return Err(anyhow::anyhow!("消息内容不能为空"));
        }

        if content.len() > max_length {
            return Err(anyhow::anyhow!("消息内容不能超过{}个字符", max_length));
        }

        // 检查敏感词（这里只是示例）
        let sensitive_words = ["测试敏感词"];
        for word in sensitive_words.iter() {
            if content.contains(word) {
                return Err(anyhow::anyhow!("消息内容包含敏感词"));
            }
        }

        Ok(())
    }

    pub fn sanitize_filename(filename: &str) -> String {
        // 移除或替换文件名中的非法字符
        let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
        let mut sanitized = filename.to_string();

        for char in invalid_chars.iter() {
            sanitized = sanitized.replace(*char, "_");
        }

        // 限制文件名长度
        if sanitized.len() > 255 {
            sanitized.truncate(252);
            sanitized.push_str("...");
        }

        sanitized
    }

    pub fn validate_age(age: u32) -> bool {
        age > 0 && age <= 150
    }

    pub fn validate_tag(tag: &str) -> Result<()> {
        if tag.trim().is_empty() {
            return Err(anyhow::anyhow!("标签不能为空"));
        }

        if tag.len() > 20 {
            return Err(anyhow::anyhow!("标签长度不能超过20个字符"));
        }

        let tag_regex = Regex::new(r"^[\u4e00-\u9fa5a-zA-Z0-9]+$").unwrap();
        if !tag_regex.is_match(tag) {
            return Err(anyhow::anyhow!("标签只能包含中文、字母和数字"));
        }

        Ok(())
    }
}