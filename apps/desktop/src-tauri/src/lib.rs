use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[derive(serde::Serialize)]
struct CursorPosition {
    x: f64,
    y: f64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            capture_item_text,
            cursor_position,
            is_poe_focused
        ])
        .setup(|app| {
            let handle = app.handle();
            let show_overlay = MenuItem::with_id(handle, "show_overlay", "Show Overlay", true, None::<&str>)?;
            let exit = MenuItem::with_id(handle, "exit", "Exit Zoe Overlay", true, None::<&str>)?;
            let tray_menu = Menu::with_items(handle, &[&show_overlay, &exit])?;
            let tray = TrayIconBuilder::with_id("zoe-overlay")
                .tooltip("Zoe Trade Overlay")
                .menu(&tray_menu)
                .show_menu_on_left_click(true);

            if let Some(icon) = app.default_window_icon() {
                tray.icon(icon.clone()).build(handle)?;
            } else {
                tray.build(handle)?;
            }

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let position = monitor.position();
                    let size = monitor.size();
                    let _ = window.set_fullscreen(false);
                    let _ = window.set_decorations(false);
                    let _ = window.set_shadow(false);
                    let _ = window.set_resizable(false);
                    let _ = window.set_maximizable(false);
                    let _ = window.set_minimizable(false);
                    let _ = window.set_position(tauri::PhysicalPosition::new(position.x, position.y));
                    let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height));
                }

                let _ = window.set_decorations(false);
                let _ = window.set_shadow(false);
                let _ = window.set_resizable(false);
                let _ = window.set_maximizable(false);
                let _ = window.set_minimizable(false);
                let _ = window.set_always_on_top(true);
                let _ = window.set_ignore_cursor_events(true);
            }

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_overlay" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.set_ignore_cursor_events(false);
                }
            }
            "exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Zoe desktop app");
}

#[tauri::command]
fn capture_item_text() -> Result<String, String> {
    capture_item_text_from_clipboard()
}

#[tauri::command]
fn is_poe_focused() -> bool {
    active_process_name()
        .map(|name| {
            let normalized = name.to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "pathofexile.exe"
                    | "pathofexilesteam.exe"
                    | "pathofexile_x64.exe"
                    | "pathofexile_x64steam.exe"
                    | "pathofexile2.exe"
                    | "pathofexile2steam.exe"
            ) || normalized.contains("pathofexile")
        })
        .unwrap_or(false)
}

#[tauri::command]
fn cursor_position(window: tauri::Window) -> Option<CursorPosition> {
    cursor_position_in_window(&window)
}

#[cfg(target_os = "windows")]
fn cursor_position_in_window(window: &tauri::Window) -> Option<CursorPosition> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    unsafe {
        let mut cursor = POINT { x: 0, y: 0 };
        GetCursorPos(&mut cursor).ok()?;
        let window_position = window.outer_position().ok()?;
        let scale_factor = window.scale_factor().ok()?;

        Some(CursorPosition {
            x: f64::from(cursor.x - window_position.x) / scale_factor,
            y: f64::from(cursor.y - window_position.y) / scale_factor,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn cursor_position_in_window(_window: &tauri::Window) -> Option<CursorPosition> {
    None
}

#[cfg(target_os = "windows")]
fn capture_item_text_from_clipboard() -> Result<String, String> {
    use std::thread;
    use std::time::Duration;

    let previous_clipboard = read_clipboard_text().unwrap_or_default();
    run_powershell("[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') > $null; [System.Windows.Forms.SendKeys]::SendWait('^c')", None)?;
    thread::sleep(Duration::from_millis(140));
    let item_text = read_clipboard_text()?;

    if !previous_clipboard.is_empty() && previous_clipboard != item_text {
        let _ = run_powershell("Set-Clipboard", Some(previous_clipboard.as_str()));
    }

    if item_text.trim().is_empty() {
        Err("No item text was copied. Hover an item in Path of Exile 2 and press Ctrl+D.".to_string())
    } else {
        Ok(item_text)
    }
}

#[cfg(target_os = "windows")]
fn active_process_name() -> Option<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let foreground_window = GetForegroundWindow();
        if foreground_window.0.is_null() {
            return None;
        }

        let mut process_id = 0;
        GetWindowThreadProcessId(foreground_window, Some(&mut process_id));
        if process_id == 0 {
            return None;
        }

        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;
        let mut buffer = [0u16; MAX_PATH as usize];
        let mut size = buffer.len() as u32;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(process);

        if result.is_err() || size == 0 {
            return None;
        }

        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        path.rsplit(['\\', '/']).next().map(str::to_string)
    }
}

#[cfg(not(target_os = "windows"))]
fn active_process_name() -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
fn read_clipboard_text() -> Result<String, String> {
    run_powershell("Get-Clipboard -Raw", None).map(|text| text.trim_end_matches(['\r', '\n']).to_string())
}

#[cfg(target_os = "windows")]
fn run_powershell(command: &str, stdin_text: Option<&str>) -> Result<String, String> {
    use std::io::Write;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut child = Command::new("powershell")
        .args(["-NoProfile", "-STA", "-Command", command])
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(if stdin_text.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start PowerShell: {error}"))?;

    if let Some(text) = stdin_text {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|error| format!("Failed to write clipboard input: {error}"))?;
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed to read PowerShell output: {error}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(not(target_os = "windows"))]
fn capture_item_text_from_clipboard() -> Result<String, String> {
    Err("Item capture is currently implemented for Windows only.".to_string())
}
