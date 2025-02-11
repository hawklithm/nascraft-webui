# NASCraft Web UI

The repository of the corresponding backend project is [here](https://github.com/hawklithm/nascraft).

This project is the frontend for the NASCraft Management System, built with React, Ant Design, and Tauri. It provides a user-friendly interface for managing file uploads, system initialization, and viewing uploaded files.

## Features

- **System Initialization**: Initialize system settings and database structure
- **File Upload**: Support large file uploads with chunk-based uploading and progress tracking
- **File Monitoring**: Monitor specified directories for file changes and auto-upload
- **File Management**: Browse and manage uploaded files with sorting and filtering
- **Progress Tracking**: Real-time upload progress monitoring with a floating window
- **Responsive Design**: Optimized for various screen sizes with collapsible navigation

## Technologies Used

- **React**: Frontend framework for building the user interface
- **Ant Design**: UI component library for elegant and responsive designs
- **Tauri**: Framework for building lightweight desktop applications
- **React Router**: For handling navigation and routing
- **dayjs**: For date formatting and manipulation
- **SparkMD5**: For file checksum calculation

## Prerequisites

- Node.js (v14 or higher)
- Rust (latest stable version)
- Tauri CLI
- System-specific dependencies for Tauri development:
  - Windows: Microsoft Visual Studio C++ Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: Required development packages (varies by distribution)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nascraft-webui.git
   ```

2. Navigate to the project directory:
   ```bash
   cd nascraft-webui
   ```

3. Install npm dependencies:
   ```bash
   npm install
   ```

## Development

### Running in Development Mode

1. Start the development server:
   ```bash
   npm run tauri dev
   ```
   This will:
   - Start the React development server
   - Launch the Tauri application
   - Enable hot-reloading for both frontend and Rust code

### Building for Production

1. Build the application:
   ```bash
   npm run tauri build
   ```
   This will:
   - Build the React application
   - Compile the Rust code
   - Package everything into a native executable
   - Output the installer in `src-tauri/target/release`

## Project Structure

- `src/`: React application source code
  - `components/`: Reusable React components
  - `pages/`: Main application pages
  - `utils/`: Utility functions and API calls
  - `i18n/`: Internationalization setup
- `src-tauri/`: Tauri application source code
  - `src/`: Rust source code
  - `capabilities/`: Tauri capability configurations
  - `target/`: Build outputs

## Key Features Implementation

- **File Upload**: Implements chunk-based uploading with MD5 checksum verification
- **Directory Monitoring**: Uses Tauri's file system API to watch specified directories
- **System Initialization**: Handles database structure and configuration file setup
- **Progress Tracking**: Provides real-time progress updates through a floating window

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.