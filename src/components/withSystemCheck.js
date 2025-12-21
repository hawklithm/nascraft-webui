import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { startWatching } from '../utils/fileWatcher';
import { checkSystemInitialization } from '../utils/systemCheck';
import { Spin, message } from 'antd';

const withSystemCheck = (WrappedComponent) => {
  return function WithSystemCheck(props) {
    const history = useHistory();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      const checkSystem = async () => {
        try {
          // await checkSystemInitialization();
          await startWatching();
          setChecking(false);
        } catch (error) {
          console.error('System not initialized:', error);
          message.error('系统未初始化，即将跳转到初始化页面');
          history.push('/system-init');
        }
      };

      checkSystem();
    }, [history]);

    if (checking) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Spin size="large" tip="检查系统状态..." />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
};

export default withSystemCheck; 