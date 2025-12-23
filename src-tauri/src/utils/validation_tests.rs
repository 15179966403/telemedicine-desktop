// 验证工具测试

#[cfg(test)]
mod tests {
    use super::super::validation::*;
    use crate::models::*;
    use chrono::Utc;

    #[test]
    fn test_validate_login_credentials_password() {
        let valid_credentials = LoginCredentials {
            login_type: LoginType::Password,
            username: Some("testuser".to_string()),
            password: Some("password123".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&valid_credentials);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_login_credentials_password_missing_username() {
        let invalid_credentials = LoginCredentials {
            login_type: LoginType::Password,
            username: None,
            password: Some("password123".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&invalid_credentials);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "username");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_login_credentials_password_short_password() {
        let invalid_credentials = LoginCredentials {
            login_type: LoginType::Password,
            username: Some("testuser".to_string()),
            password: Some("123".to_string()),
            phone: None,
            sms_code: None,
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&invalid_credentials);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "password");
        assert_eq!(result.errors[0].code, "MIN_LENGTH");
    }

    #[test]
    fn test_validate_login_credentials_sms() {
        let valid_credentials = LoginCredentials {
            login_type: LoginType::Sms,
            username: None,
            password: None,
            phone: Some("13812345678".to_string()),
            sms_code: Some("123456".to_string()),
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&valid_credentials);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_login_credentials_sms_invalid_phone() {
        let invalid_credentials = LoginCredentials {
            login_type: LoginType::Sms,
            username: None,
            password: None,
            phone: Some("12345".to_string()),
            sms_code: Some("123456".to_string()),
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&invalid_credentials);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "phone");
        assert_eq!(result.errors[0].code, "INVALID_FORMAT");
    }

    #[test]
    fn test_validate_login_credentials_sms_invalid_code() {
        let invalid_credentials = LoginCredentials {
            login_type: LoginType::Sms,
            username: None,
            password: None,
            phone: Some("13812345678".to_string()),
            sms_code: Some("123".to_string()),
            id_card: None,
        };

        let result = ValidationService::validate_login_credentials(&invalid_credentials);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "smsCode");
        assert_eq!(result.errors[0].code, "INVALID_FORMAT");
    }

    #[test]
    fn test_validate_login_credentials_realname() {
        let valid_credentials = LoginCredentials {
            login_type: LoginType::Realname,
            username: None,
            password: None,
            phone: None,
            sms_code: None,
            id_card: Some("110101199001011234".to_string()),
        };

        let result = ValidationService::validate_login_credentials(&valid_credentials);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_patient_valid() {
        let valid_patient = Patient {
            id: "patient-123".to_string(),
            name: "张三".to_string(),
            age: 30,
            gender: Gender::Male,
            phone: "13812345678".to_string(),
            id_card: Some("110101199001011234".to_string()),
            avatar: None,
            tags: vec!["高血压".to_string(), "糖尿病".to_string()],
            last_visit: None,
            medical_history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = ValidationService::validate_patient(&valid_patient);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_patient_empty_name() {
        let invalid_patient = Patient {
            id: "patient-123".to_string(),
            name: "".to_string(),
            age: 30,
            gender: Gender::Male,
            phone: "13812345678".to_string(),
            id_card: None,
            avatar: None,
            tags: vec![],
            last_visit: None,
            medical_history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = ValidationService::validate_patient(&invalid_patient);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "name");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_patient_invalid_age() {
        let invalid_patient = Patient {
            id: "patient-123".to_string(),
            name: "张三".to_string(),
            age: 200,
            gender: Gender::Male,
            phone: "13812345678".to_string(),
            id_card: None,
            avatar: None,
            tags: vec![],
            last_visit: None,
            medical_history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = ValidationService::validate_patient(&invalid_patient);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "age");
        assert_eq!(result.errors[0].code, "OUT_OF_RANGE");
    }

    #[test]
    fn test_validate_patient_invalid_phone() {
        let invalid_patient = Patient {
            id: "patient-123".to_string(),
            name: "张三".to_string(),
            age: 30,
            gender: Gender::Male,
            phone: "12345".to_string(),
            id_card: None,
            avatar: None,
            tags: vec![],
            last_visit: None,
            medical_history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let result = ValidationService::validate_patient(&invalid_patient);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "phone");
        assert_eq!(result.errors[0].code, "INVALID_FORMAT");
    }

    #[test]
    fn test_validate_send_message_request_text() {
        let valid_request = SendMessageRequest {
            consultation_id: "consultation-123".to_string(),
            message_type: MessageType::Text,
            content: "Hello, this is a test message".to_string(),
            file_id: None,
            reply_to: None,
        };

        let result = ValidationService::validate_send_message_request(&valid_request);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_send_message_request_empty_consultation_id() {
        let invalid_request = SendMessageRequest {
            consultation_id: "".to_string(),
            message_type: MessageType::Text,
            content: "Hello".to_string(),
            file_id: None,
            reply_to: None,
        };

        let result = ValidationService::validate_send_message_request(&invalid_request);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "consultationId");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_send_message_request_empty_content() {
        let invalid_request = SendMessageRequest {
            consultation_id: "consultation-123".to_string(),
            message_type: MessageType::Text,
            content: "".to_string(),
            file_id: None,
            reply_to: None,
        };

        let result = ValidationService::validate_send_message_request(&invalid_request);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "content");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_send_message_request_file_without_file_id() {
        let invalid_request = SendMessageRequest {
            consultation_id: "consultation-123".to_string(),
            message_type: MessageType::File,
            content: "file description".to_string(),
            file_id: None,
            reply_to: None,
        };

        let result = ValidationService::validate_send_message_request(&invalid_request);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "fileId");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_patient_query_valid() {
        let valid_query = PatientQuery {
            keyword: Some("张三".to_string()),
            tags: Some(vec!["高血压".to_string()]),
            gender: Some(Gender::Male),
            age_range: Some(AgeRange { min: 20, max: 60 }),
            last_visit_range: None,
            page: 1,
            page_size: 20,
        };

        let result = ValidationService::validate_patient_query(&valid_query);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_patient_query_invalid_page() {
        let invalid_query = PatientQuery {
            keyword: None,
            tags: None,
            gender: None,
            age_range: None,
            last_visit_range: None,
            page: 0,
            page_size: 20,
        };

        let result = ValidationService::validate_patient_query(&invalid_query);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "page");
        assert_eq!(result.errors[0].code, "MIN_VALUE");
    }

    #[test]
    fn test_validate_patient_query_invalid_page_size() {
        let invalid_query = PatientQuery {
            keyword: None,
            tags: None,
            gender: None,
            age_range: None,
            last_visit_range: None,
            page: 1,
            page_size: 200,
        };

        let result = ValidationService::validate_patient_query(&invalid_query);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "pageSize");
        assert_eq!(result.errors[0].code, "OUT_OF_RANGE");
    }

    #[test]
    fn test_validate_patient_query_invalid_age_range() {
        let invalid_query = PatientQuery {
            keyword: None,
            tags: None,
            gender: None,
            age_range: Some(AgeRange { min: 60, max: 30 }),
            last_visit_range: None,
            page: 1,
            page_size: 20,
        };

        let result = ValidationService::validate_patient_query(&invalid_query);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "ageRange");
        assert_eq!(result.errors[0].code, "INVALID_RANGE");
    }

    #[test]
    fn test_validate_window_config_valid() {
        use std::collections::HashMap;

        let valid_config = WindowConfig {
            window_type: WindowType::Consultation,
            title: "Patient Consultation".to_string(),
            url: "/consultation/123".to_string(),
            data: Some(WindowData {
                consultation_id: Some("consultation-123".to_string()),
                patient_id: Some("patient-123".to_string()),
                extra: HashMap::new(),
            }),
            width: Some(800),
            height: Some(600),
            min_width: None,
            min_height: None,
            resizable: Some(true),
            center: Some(true),
            always_on_top: Some(false),
        };

        let result = ValidationService::validate_window_config(&valid_config);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_window_config_empty_title() {
        use std::collections::HashMap;

        let invalid_config = WindowConfig {
            window_type: WindowType::Consultation,
            title: "".to_string(),
            url: "/consultation/123".to_string(),
            data: None,
            width: None,
            height: None,
            min_width: None,
            min_height: None,
            resizable: None,
            center: None,
            always_on_top: None,
        };

        let result = ValidationService::validate_window_config(&invalid_config);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "title");
        assert_eq!(result.errors[0].code, "REQUIRED");
    }

    #[test]
    fn test_validate_window_config_small_dimensions() {
        use std::collections::HashMap;

        let invalid_config = WindowConfig {
            window_type: WindowType::Consultation,
            title: "Test Window".to_string(),
            url: "/test".to_string(),
            data: None,
            width: Some(100),
            height: Some(50),
            min_width: None,
            min_height: None,
            resizable: None,
            center: None,
            always_on_top: None,
        };

        let result = ValidationService::validate_window_config(&invalid_config);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 2);
        assert_eq!(result.errors[0].field, "width");
        assert_eq!(result.errors[0].code, "MIN_VALUE");
        assert_eq!(result.errors[1].field, "height");
        assert_eq!(result.errors[1].code, "MIN_VALUE");
    }

    #[test]
    fn test_validate_file_info_valid() {
        let valid_file = FileInfo {
            id: "file-123".to_string(),
            name: "test.jpg".to_string(),
            size: 1024 * 500, // 500KB
            file_type: "image/jpeg".to_string(),
            url: "https://example.com/test.jpg".to_string(),
            local_path: None,
            thumbnail: None,
        };

        let max_size = 1024 * 1024; // 1MB
        let allowed_types = vec!["image/jpeg".to_string(), "image/png".to_string()];

        let result = ValidationService::validate_file_info(&valid_file, max_size, &allowed_types);
        assert!(result.is_valid);
        assert_eq!(result.errors.len(), 0);
    }

    #[test]
    fn test_validate_file_info_too_large() {
        let invalid_file = FileInfo {
            id: "file-123".to_string(),
            name: "test.jpg".to_string(),
            size: 2 * 1024 * 1024, // 2MB
            file_type: "image/jpeg".to_string(),
            url: "https://example.com/test.jpg".to_string(),
            local_path: None,
            thumbnail: None,
        };

        let max_size = 1024 * 1024; // 1MB
        let allowed_types = vec!["image/jpeg".to_string(), "image/png".to_string()];

        let result = ValidationService::validate_file_info(&invalid_file, max_size, &allowed_types);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "size");
        assert_eq!(result.errors[0].code, "FILE_TOO_LARGE");
    }

    #[test]
    fn test_validate_file_info_unsupported_type() {
        let invalid_file = FileInfo {
            id: "file-123".to_string(),
            name: "test.exe".to_string(),
            size: 1024 * 500, // 500KB
            file_type: "application/x-msdownload".to_string(),
            url: "https://example.com/test.exe".to_string(),
            local_path: None,
            thumbnail: None,
        };

        let max_size = 1024 * 1024; // 1MB
        let allowed_types = vec!["image/jpeg".to_string(), "image/png".to_string()];

        let result = ValidationService::validate_file_info(&invalid_file, max_size, &allowed_types);
        assert!(!result.is_valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].field, "type");
        assert_eq!(result.errors[0].code, "UNSUPPORTED_TYPE");
    }

    // Basic validation method tests
    #[test]
    fn test_validate_phone() {
        assert!(ValidationService::validate_phone("13812345678"));
        assert!(ValidationService::validate_phone("15987654321"));
        assert!(!ValidationService::validate_phone("12345678901"));
        assert!(!ValidationService::validate_phone("1381234567"));
        assert!(!ValidationService::validate_phone("138123456789"));
        assert!(!ValidationService::validate_phone("abc12345678"));
    }

    #[test]
    fn test_validate_email() {
        assert!(ValidationService::validate_email("test@example.com"));
        assert!(ValidationService::validate_email("user.name@domain.co.uk"));
        assert!(!ValidationService::validate_email("invalid-email"));
        assert!(!ValidationService::validate_email("@example.com"));
        assert!(!ValidationService::validate_email("test@"));
    }

    #[test]
    fn test_validate_id_card() {
        assert!(ValidationService::validate_id_card("110101199001011234"));
        assert!(ValidationService::validate_id_card("31010519900101123X"));
        assert!(!ValidationService::validate_id_card("12345678901234567"));
        assert!(!ValidationService::validate_id_card("110101199013011234")); // Invalid month
        assert!(!ValidationService::validate_id_card("110101199001321234")); // Invalid day
    }

    #[test]
    fn test_validate_sms_code() {
        assert!(ValidationService::validate_sms_code("123456"));
        assert!(ValidationService::validate_sms_code("000000"));
        assert!(!ValidationService::validate_sms_code("12345"));
        assert!(!ValidationService::validate_sms_code("1234567"));
        assert!(!ValidationService::validate_sms_code("12345a"));
    }

    #[test]
    fn test_validate_chinese_name() {
        assert!(ValidationService::validate_chinese_name("张三"));
        assert!(ValidationService::validate_chinese_name("李小明"));
        assert!(ValidationService::validate_chinese_name("王·丽"));
        assert!(!ValidationService::validate_chinese_name("张"));
        assert!(!ValidationService::validate_chinese_name("Zhang San"));
        assert!(!ValidationService::validate_chinese_name("张三李四王五赵六钱七"));
    }

    #[test]
    fn test_validate_age() {
        assert!(ValidationService::validate_age(1));
        assert!(ValidationService::validate_age(30));
        assert!(ValidationService::validate_age(150));
        assert!(!ValidationService::validate_age(0));
        assert!(!ValidationService::validate_age(151));
    }

    #[test]
    fn test_format_file_size() {
        assert_eq!(ValidationService::format_file_size(0), "0 Bytes");
        assert_eq!(ValidationService::format_file_size(1024), "1.00 KB");
        assert_eq!(ValidationService::format_file_size(1024 * 1024), "1.00 MB");
        assert_eq!(ValidationService::format_file_size(1024 * 1024 * 1024), "1.00 GB");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(ValidationService::sanitize_filename("test.txt"), "test.txt");
        assert_eq!(ValidationService::sanitize_filename("test<>file.txt"), "test__file.txt");
        assert_eq!(ValidationService::sanitize_filename("test:file|name.txt"), "test_file_name.txt");

        let long_name = "a".repeat(300);
        let sanitized = ValidationService::sanitize_filename(&long_name);
        assert!(sanitized.len() <= 255);
        assert!(sanitized.ends_with("..."));
    }

    #[test]
    fn test_validate_date_range() {
        let now = Utc::now();
        let past = now - chrono::Duration::hours(1);
        let future = now + chrono::Duration::hours(1);

        // Valid range
        let result = ValidationService::validate_date_range(&past, &now);
        assert!(result.is_valid);

        // Invalid range (start > end)
        let result = ValidationService::validate_date_range(&now, &past);
        assert!(!result.is_valid);
        assert_eq!(result.errors[0].code, "INVALID_RANGE");

        // Future start date
        let result = ValidationService::validate_date_range(&future, &future);
        assert!(!result.is_valid);
        assert_eq!(result.errors[0].code, "FUTURE_DATE");
    }
}