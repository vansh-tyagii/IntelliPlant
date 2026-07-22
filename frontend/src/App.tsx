import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import { AppLayout } from '@/layouts/AppLayout'

// Lazy-loaded pages
const Landing = lazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })))
const Overview = lazy(() => import('@/pages/Overview').then(m => ({ default: m.Overview })))
const Plant = lazy(() => import('@/pages/Plant').then(m => ({ default: m.Plant })))
const Operations = lazy(() => import('@/pages/Operations').then(m => ({ default: m.Operations })))
const AiInsights = lazy(() => import('@/pages/AiInsights').then(m => ({ default: m.AiInsights })))
const Incidents = lazy(() => import('@/pages/Incidents').then(m => ({ default: m.Incidents })))
const Compliance = lazy(() => import('@/pages/Compliance').then(m => ({ default: m.Compliance })))
const Timeline = lazy(() => import('@/pages/Timeline').then(m => ({ default: m.Timeline })))
const SystemHealth = lazy(() => import('@/pages/SystemHealth').then(m => ({ default: m.SystemHealth })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
})

const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#0066ff',
    colorBgBase: '#10131c',
    colorBgContainer: '#1d1f28',
    colorBgElevated: '#272a33',
    colorBgLayout: '#10131c',
    colorBgSpotlight: '#191b24',
    colorBorder: '#424656',
    colorBorderSecondary: '#272a33',
    colorText: '#e1e2ee',
    colorTextSecondary: '#c2c6d8',
    colorTextTertiary: '#8c90a1',
    colorTextQuaternary: '#424656',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontFamilyCode: "'JetBrains Mono', monospace",
    borderRadius: 4,
    borderRadiusLG: 8,
    borderRadiusSM: 2,
    colorError: '#ef4444',
    colorWarning: '#f59e0b',
    colorSuccess: '#22c55e',
    colorInfo: '#b3c5ff',
    controlHeight: 32,
    lineWidth: 1,
    wireframe: false,
  },
  components: {
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#191b24',
      rowHoverBg: '#272a33',
    },
    Select: {
      colorBgContainer: '#191b24',
      colorBgElevated: '#1d1f28',
      optionSelectedBg: '#272a33',
    },
    Input: { colorBgContainer: '#191b24' },
    InputNumber: { colorBgContainer: '#191b24' },
    Modal: { contentBg: '#1d1f28', headerBg: '#191b24' },
    Drawer: { colorBgElevated: '#1d1f28' },
    Steps: { colorPrimary: '#0066ff' },
    Upload: { colorFillAlter: '#191b24', colorBorder: '#424656' },
    Collapse: { colorBgContainer: 'transparent', headerBg: '#191b24' },
    Tabs: { inkBarColor: '#0066ff', itemSelectedColor: '#b3c5ff' },
    Badge: { colorError: '#ef4444' },
    Notification: { colorBgElevated: '#1d1f28' },
  },
}

const PageLoader: React.FC = () => (
  <div className="flex-1 flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-[#0066ff] border-t-transparent rounded-full animate-spin" />
      <p className="font-mono text-[10px] text-[#8c90a1] tracking-widest uppercase">Loading</p>
    </div>
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <BrowserRouter>
            <Suspense fallback={<div className="h-screen bg-[#10131c] flex items-center justify-center"><PageLoader /></div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<AppLayout />}>
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/plant" element={<Plant />} />
                  <Route path="/operations" element={<Operations />} />
                  <Route path="/ai-insights" element={<AiInsights />} />
                  <Route path="/incidents" element={<Incidents />} />
                  <Route path="/compliance" element={<Compliance />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/system" element={<SystemHealth />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/overview" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App
