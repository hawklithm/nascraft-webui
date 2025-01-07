import { apiFetch } from './apiFetch';
import { checkSysConf } from '../pages/SystemInit';
import { platform } from '@tauri-apps/plugin-os';

export const checkSystemInitialization = async () => {
  try {
    // 检查数据库结构
    await apiFetch('/check_table_structure', {
      method: 'GET'
    }, false);

    // 检查运行环境
    let platform_name = "unknown";
    try {
      platform_name = await platform();
    } catch(e) {
      console.log("not in tauri environment");
    }

    // 如果在 Tauri 环境中，检查配置文件
    if (platform_name !== "unknown") {
      await checkSysConf();
    }

    return true;
  } catch (error) {
    console.error('System initialization check failed:', error);
    throw error;
  }
}; 