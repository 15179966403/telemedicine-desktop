// 验证工具

use regex::Regex;
use anyhow::Result;
use chrono::{DateTime, Utc};
use crate::models::*;

#[derive(Debug, Clone)]
pub struct ValidationViolation {
    pub field: String,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationViolation>,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            is_valid: true,
            errors: Vec::new(),
        }
    }

    pub fn add_error(&mut self, field: &str, message: &str, code: &str) {
        self.is_valid = false;
        self.errors.push(ValidationViolation {
            field: field.to_string(),
            message: message.to_string(),
            code: code.to_string(),
        });
    }

    pub fn merge(&mut self, other: ValidationResult) {
        if !other.is_valid {
            self.is_valid = false;
            self.errors.extend(other.errors);
        }
    }
}

pub struct ValidationService;

impl ValidationService {
    // 验证登录凭证
    pub fn validate_login_credentials(credentials: &LoginCredentials) -> ValidationResult {
        let mut result = ValidationResult::new();

        match credentials.login_type {
            LoginType::Password => {
                if let Some(username) = &credentials.username {
                    if username.trim().is_empty() {
                        result.add_error("username", "用户名不能为空", "REQUIRED");
                    }
                } else {
                    result.add_error("username", "用户名不能为空", "REQUIRED");
                }

                if let Some(password) = &credentials.password {
                    if password.len() < 6 {
                        result.add_error("password", "密码长度不能少于6位", "MIN_LENGTH");
                    }
                } else {
                    result.add_error("password", "密码不能为空", "REQUIRED");
                }
            }
            LoginType::Sms => {
                if let Some(phone) = &credentials.phone {
                    if !Self::validate_phone(phone) {
                        result.add_error("phone", "手机号格式不正确", "INVALID_FORMAT");
                    }
                } else {
                    result.add_error("phone", "手机号不能为空", "REQUIRED");
                }

                if let Some(sms_code) = &credentials.sms_code {
                    if !Self::validate_sms_code(sms_code) {
                        result.add_error("smsCode", "验证码必须是6位数字", "INVALID_FORMAT");
                    }
                } else {
                    result.add_error("smsCode", "验证码不能为空", "REQUIRED");
                }
            }
            LoginType::Realname => {
                if let Some(id_card) = &credentials.id_card {
                    if !Self::validate_id_card(id_card) {
                        result.add_error("idCard", "身份证号格式不正确", "INVALID_FORMAT");
                    }
                } else {
                    result.add_error("idCard", "身份证号不能为空", "REQUIRED");
                }
            }
        }

        result
    }

    // 验证患者信息
    pub fn validate_patient(patient: &Patient) -> ValidationResult {
        let mut result = ValidationResult::new();

        // 验证姓名
        if patient.name.trim().is_empty() {
            result.add_error("name", "患者姓名不能为空", "REQUIRED");
        } else if patient.name.len() > 50 {
            result.add_error("name", "患者姓名不能超过50个字符", "MAX_LENGTH");
        } else if !Self::validate_chinese_name(&patient.name) {
            result.add_error("name", "患者姓名格式不正确", "INVALID_FORMAT");
        }

        // 验证年龄
        if !Self::validate_age(patient.age) {
            result.add_error("age", "年龄必须在0-150之间", "OUT_OF_RANGE");
        }

        // 验证手机号
        if !Self::validate_phone(&patient.phone) {
            result.add_error("phone", "手机号格式不正确", "INVALID_FORMAT");
        }

        // 验证身份证号（如果提供）
        if let Some(id_card) = &patient.id_card {
            if !Self::validate_id_card(id_card) {
                result.add_error("idCard", "身份证号格式不正确", "INVALID_FORMAT");
            }
        }

        // 验证标签
        for (index, tag) in patient.tags.iter().enumerate() {
            if let Err(e) = Self::validate_tag(tag) {
                result.add_error(&format!("tags[{}]", index), &e.to_string(), "INVALID_TAG");
            }
        }

        result
    }

    // 验证消息发送请求
    pub fn validate_send_message_request(request: &SendMessageRequest) -> ValidationResult {
        let mut result = ValidationResult::new();

        // 验证问诊ID
        if request.consultation_id.trim().is_empty() {
            result.add_error("consultationId", "问诊ID不能为空", "REQUIRED");
        }

        // 验证消息内容
        match request.message_type {
            MessageType::Text | MessageType::Template => {
                if request.content.trim().is_empty() {
                    result.add_error("content", "消息内容不能为空", "REQUIRED");
                } else if request.content.len() > 5000 {
                    result.add_error("content", "消息内容不能超过5000个字符", "MAX_LENGTH");
                }
            }
            MessageType::Image | MessageType::Voice | MessageType::File => {
                if request.file_id.is_none() {
                    result.add_error("fileId", "文件ID不能为空", "REQUIRED");
                }
            }
        }

        result
    }

    // 验证患者查询参数
    pub fn validate_patient_query(query: &PatientQuery) -> ValidationResult {
        let mut result = ValidationResult::new();

        // 验证分页参数
        if query.page < 1 {
            result.add_error("page", "页码必须大于0", "MIN_VALUE");
        }

        if query.page_size < 1 || query.page_size > 100 {
            result.add_error("pageSize", "每页数量必须在1-100之间", "OUT_OF_RANGE");
        }

        // 验证年龄范围
        if let Some(age_range) = &query.age_range {
            if age_range.min > 150 || age_range.max > 150 {
                result.add_error("ageRange", "年龄范围必须在0-150之间", "OUT_OF_RANGE");
            }
            if age_range.min > age_range.max {
                result.add_error("ageRange", "最小年龄不能大于最大年龄", "INVALID_RANGE");
            }
        }

        result
    }

    // 验证窗口配置
    pub fn validate_window_config(config: &WindowConfig) -> ValidationResult {
        let mut result = ValidationResult::new();

        // 验证标题
        if config.title.trim().is_empty() {
            result.add_error("title", "窗口标题不能为空", "REQUIRED");
        }

        // 验证URL
        if config.url.trim().is_empty() {
            result.add_error("url", "窗口URL不能为空", "REQUIRED");
        }

        // 验证尺寸
        if let Some(width) = config.width {
            if width < 200 {
                result.add_error("width", "窗口宽度不能小于200px", "MIN_VALUE");
            }
        }

        if let Some(height) = config.height {
            if height < 150 {
                result.add_error("height", "窗口高度不能小于150px", "MIN_VALUE");
            }
        }

        result
    }

    // 验证文件信息
    pub fn validate_file_info(file_info: &FileInfo, max_size: u64, allowed_types: &[String]) -> ValidationResult {
        let mut result = ValidationResult::new();

        // 验证文件大小
        if file_info.size > max_size {
            result.add_error("size", &format!("文件大小超过限制: {} > {}",
                Self::format_file_size(file_info.size),
                Self::format_file_size(max_size)), "FILE_TOO_LARGE");
        }

        // 验证文件类型
        if !allowed_types.contains(&file_info.file_type) {
            result.add_error("type", &format!("不支持的文件类型: {}", file_info.file_type), "UNSUPPORTED_TYPE");
        }

        // 验证文件名
        if file_info.name.trim().is_empty() {
            result.add_error("name", "文件名不能为空", "REQUIRED");
        }

        result
    }

    // 基础验证方法
    pub fn validate_phone(phone: &str) -> bool {
        let phone_regex = Regex::new(r"^1[3-9]\d{9}$").unwrap();
        phone_regex.is_match(phone)
    }

    pub fn validate_email(email: &str) -> bool {
        let email_regex = Regex::new(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").unwrap();
        email_regex.is_match(email)
    }

    pub fn validate_id_card(id_card: &str) -> bool {
        let id_regex = Regex::new(r"^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$").unwrap();
        id_regex.is_match(id_card)
    }

    pub fn validate_sms_code(code: &str) -> bool {
        let code_regex = Regex::new(r"^\d{6}$").unwrap();
        code_regex.is_match(code)
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
        let has_special = Regex::new(r"[!@#$%^&*(),.?:{}|<>]").unwrap().is_match(password);

        let strength_count = [has_lowercase, has_uppercase, has_digit, has_special]
            .iter()
            .filter(|&&x| x)
            .count();

        if strength_count < 3 {
            return Err(anyhow::anyhow!("密码必须包含至少3种字符类型(大写字母,小写字母,数字,特殊字符)"));
        }

        Ok(())
    }

    pub fn validate_chinese_name(name: &str) -> bool {
        let chinese_name_regex = Regex::new(r"^[\u{4e00}-\u{9fa5}]{2,10}$").unwrap();
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
            return Err(anyhow::anyhow!("消息内容不能超过 {} 个字符", max_length));
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
        let invalid_chars = r#"<>:"/\|?*"#;
        let mut sanitized = filename.to_string();

        for ch in invalid_chars.chars() {
            sanitized = sanitized.replace(ch, "_");
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

        let tag_regex = Regex::new(r"^[\u{4e00}-\u{9fa5}a-zA-Z0-9]+$").unwrap();
        if !tag_regex.is_match(tag) {
            return Err(anyhow::anyhow!("标签只能包含中文、字母和数字"));
        }

        Ok(())
    }

    // 辅助方法：格式化文件大小
    pub fn format_file_size(bytes: u64) -> String {
        if bytes == 0 {
            return "0 Bytes".to_string();
        }

        let k = 1024u64;
        let sizes = ["Bytes", "KB", "MB", "GB"];
        let i = (bytes as f64).log(k as f64).floor() as usize;
        let size = bytes as f64 / (k.pow(i as u32) as f64);

        format!("{:.2} {}", size, sizes[i.min(sizes.len() - 1)])
    }

    // 验证日期范围
    pub fn validate_date_range(start: &DateTime<Utc>, end: &DateTime<Utc>) -> ValidationResult {
        let mut result = ValidationResult::new();

        if start > end {
            result.add_error("dateRange", "开始时间不能晚于结束时间", "INVALID_RANGE");
        }

        let now = Utc::now();
        if start > &now {
            result.add_error("dateRange", "开始时间不能是未来时间", "FUTURE_DATE");
        }

        result
    }
}