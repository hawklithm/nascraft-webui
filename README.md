# NASCraft Web UI

The repository of the corresponding backend project is [here](https://github.com/hawklithm/nascraft).

This project is the frontend for the NASCraft Management System, built with React and Ant Design. It provides a user-friendly interface for managing file uploads, system initialization, and viewing uploaded files.

## Features

- **File Upload**: Upload files with progress tracking and chunked uploads.
- **System Initialization**: Initialize system settings and configurations.
- **View Uploaded Files**: Browse and manage uploaded files.
- **Internationalization**: Supports multiple languages with easy switching.
- **Responsive Design**: Optimized for various screen sizes.

## Technologies Used

- **React**: A JavaScript library for building user interfaces.
- **Ant Design**: A UI framework for creating elegant and responsive designs.
- **React Router**: For handling navigation and routing.
- **@ant-design/colors**: For consistent color theming.
- **Fetch API**: For making HTTP requests to the backend.

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nascraft-webui.git
   ```
2. Navigate to the project directory:
   ```bash
   cd nascraft-webui
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

### Running the Application

To start the development server, run:

```
bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

To build the app for production, run:
```
bash
npm run build
```
The build artifacts will be stored in the `build/` directory.

## Project Structure

- `src/`: Contains the source code.
  - `pages/`: Different pages of the application.
  - `components/`: Reusable components.
  - `utils/`: Utility functions and API calls.
  - `i18n/`: Internationalization setup.
- `public/`: Public assets and HTML template.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements.

## License

This project is licensed under the MIT License.