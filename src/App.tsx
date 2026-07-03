import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { StatisticsPage } from './pages/StatisticsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="categories" element={<Navigate to="/statistics" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
