import React from 'react';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';
import Welcome from './pages/Welcome';
import LoginForm from './pages/LoginForm';
import UploadForm from './pages/UploadForm';
import SystemInit from './pages/SystemInit';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/" render={() => <Redirect to="/login" />} />
        <Route path="/login" component={LoginForm} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/upload" component={UploadForm} />
        <Route path="/system-init" component={SystemInit} />
      </Switch>
    </BrowserRouter>
  );
}

export default App;
