import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1d4e89',
          colorInfo: '#1d4e89',
          colorSuccess: '#2a9d8f',
          colorWarning: '#e9c46a',
          colorError: '#e76f51',
          borderRadius: 6,
          fontFamily: '-apple-system, "Microsoft YaHei", "PingFang SC", sans-serif'
        },
        components: {
          Layout: {
            headerBg: '#0f2942',
            siderBg: '#143656',
            bodyBg: '#f5f7fa'
          },
          Menu: {
            darkItemBg: '#143656',
            darkSubMenuItemBg: '#0f2942',
            darkItemSelectedBg: '#1d4e89'
          }
        }
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
