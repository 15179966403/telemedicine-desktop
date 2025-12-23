// 患者管理相关命令

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PatientQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub search: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct Patient {
    pub id: String,
    pub name: String,
    pub age: u32,
    pub gender: String,
    pub phone: String,
    pub tags: Vec<String>,
    pub last_visit: String,
    pub medical_history: Vec<MedicalRecord>,
}

#[derive(Debug, Serialize)]
pub struct MedicalRecord {
    pub id: String,
    pub patient_id: String,
    pub doctor_id: String,
    pub diagnosis: String,
    pub treatment: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct PatientList {
    pub patients: Vec<Patient>,
    pub total: u32,
    pub page: u32,
    pub limit: u32,
}

#[tauri::command]
pub async fn get_patient_list(query: PatientQuery) -> Result<PatientList, String> {
    println!("Getting patient list with query: {:?}", query);

    // TODO: 实现从数据库获取患者列表的逻辑

    // 模拟数据库查询延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

    // 模拟患者数据
    let mock_patients = vec![
        Patient {
            id: "1".to_string(),
            name: "李小明".to_string(),
            age: 35,
            gender: "male".to_string(),
            phone: "138****1234".to_string(),
            tags: vec!["高血压".to_string(), "糖尿病".to_string()],
            last_visit: "2024-01-15T10:00:00Z".to_string(),
            medical_history: vec![],
        },
        Patient {
            id: "2".to_string(),
            name: "王小红".to_string(),
            age: 28,
            gender: "female".to_string(),
            phone: "139****5678".to_string(),
            tags: vec!["孕期检查".to_string()],
            last_visit: "2024-01-20T14:30:00Z".to_string(),
            medical_history: vec![],
        },
    ];

    let result = PatientList {
        patients: mock_patients,
        total: 2,
        page: query.page.unwrap_or(1),
        limit: query.limit.unwrap_or(20),
    };

    Ok(result)
}

#[tauri::command]
pub async fn get_patient_detail(patient_id: String) -> Result<Patient, String> {
    println!("Getting patient detail for ID: {}", patient_id);

    // TODO: 实现从数据库获取患者详情的逻辑

    // 模拟数据库查询延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // 模拟患者详情数据
    let patient = Patient {
        id: patient_id.clone(),
        name: "李小明".to_string(),
        age: 35,
        gender: "male".to_string(),
        phone: "138****1234".to_string(),
        tags: vec!["高血压".to_string(), "糖尿病".to_string()],
        last_visit: "2024-01-15T10:00:00Z".to_string(),
        medical_history: vec![
            MedicalRecord {
                id: "1".to_string(),
                patient_id: patient_id.clone(),
                doctor_id: "1".to_string(),
                diagnosis: "高血压".to_string(),
                treatment: "降压药物治疗".to_string(),
                created_at: "2024-01-10T09:00:00Z".to_string(),
            },
        ],
    };

    Ok(patient)
}

#[tauri::command]
pub async fn update_patient_tags(patient_id: String, tags: Vec<String>) -> Result<(), String> {
    println!("Updating patient tags for ID: {}, tags: {:?}", patient_id, tags);

    // TODO: 实现更新患者标签的逻辑

    // 模拟数据库更新延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    Ok(())
}

#[tauri::command]
pub async fn search_patients(keyword: String) -> Result<Vec<Patient>, String> {
    println!("Searching patients with keyword: {}", keyword);

    // TODO: 实现患者搜索逻辑

    // 模拟搜索延迟
    tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;

    // 模拟搜索结果
    let results = vec![
        Patient {
            id: "1".to_string(),
            name: "李小明".to_string(),
            age: 35,
            gender: "male".to_string(),
            phone: "138****1234".to_string(),
            tags: vec!["高血压".to_string(), "糖尿病".to_string()],
            last_visit: "2024-01-15T10:00:00Z".to_string(),
            medical_history: vec![],
        },
    ];

    Ok(results)
}