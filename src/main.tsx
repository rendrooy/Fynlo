import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { BudgetsPage } from './pages/BudgetsPage'
import { HomePage } from './pages/HomePage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { FinanceProvider } from './store/finance'
import { ThemeProvider } from './store/theme'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <FinanceProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="transaksi" element={<TransactionsPage />} />
              <Route path="anggaran" element={<BudgetsPage />} />
              <Route path="laporan" element={<ReportsPage />} />
              <Route path="pengaturan" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FinanceProvider>
    </ThemeProvider>
  </StrictMode>,
)
