import React from 'react';
import { BrowserRouter as Router, Route, Switch, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import LoginForm from './pages/LoginForm';
import Welcome from './pages/Welcome';
import SystemInit from './pages/SystemInit';
import UploadForm from './pages/UploadForm';
import UploadedFiles from './pages/UploadedFiles';
import UploadProgress from './components/UploadProgress';
import Header from './components/Header';
import Navigation from './components/Navigation';
import VideoList from './pages/VideoList';

const { Content } = Layout;

const UploadProgressWrapper = () => {
  const location = useLocation();
  const hiddenPaths = ['/', '/welcome'];
  
  if (hiddenPaths.includes(location.pathname)) {
    return null;
  }
  
  return <UploadProgress />;
};

const MainLayout = ({ children }) => {
  const location = useLocation();
  const hiddenPaths = ['/', '/welcome'];
  
  if (hiddenPaths.includes(location.pathname)) {
    return children;
  }

  return (
    <Layout>
      <Header />
      <Layout>
        <Navigation />
        <Layout style={{ padding: '24px' }}>
          <Content>{children}</Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <MainLayout>
        <Switch>
          <Route exact path="/" component={LoginForm} />
          <Route path="/welcome" component={Welcome} />
          <Route path="/system-init" component={SystemInit} />
          <Route path="/upload" component={UploadForm} />
          <Route path="/uploaded-files" component={UploadedFiles} />
          <Route path="/videos" component={VideoList} />
        </Switch>
        <UploadProgressWrapper />
      </MainLayout>
    </Router>
  );
}

export default App;
