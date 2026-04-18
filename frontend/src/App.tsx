import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import ReportPage from './pages/ReportPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="chat/:repoId" element={<ChatPage />} />
        <Route path="report/:repoId" element={<ReportPage />} />
      </Route>
    </Routes>
  )
}

export default App
