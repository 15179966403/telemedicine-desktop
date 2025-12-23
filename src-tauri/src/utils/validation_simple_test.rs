#[cfg(test)]
mod simple_validation_tests {
    use crate::utils::validation::ValidationService;

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
}