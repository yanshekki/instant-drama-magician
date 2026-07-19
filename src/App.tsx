import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './presentation/context/AppContext'
import { AiJobsProvider } from './presentation/context/AiJobsContext'
import {
  ToastProvider,
  ToastHost
} from './presentation/context/ToastContext'
import { DialogProvider } from './presentation/context/DialogContext'
import { Layout } from './presentation/components/Layout'
import { StoriesPage } from './presentation/pages/StoriesPage'
import { CharactersPage } from './presentation/pages/CharactersPage'
import { CostumesPage } from './presentation/pages/CostumesPage'
import { ScenesPage } from './presentation/pages/ScenesPage'
import { PropsPage } from './presentation/pages/PropsPage'
import { TimelinePage } from './presentation/pages/TimelinePage'
import { SettingsPage } from './presentation/pages/SettingsPage'
import { AuditLogPage } from './presentation/pages/AuditLogPage'
import { FirstRunModal } from './presentation/components/FirstRunModal'
import { WebAuthGate } from './presentation/components/WebAuthGate'
import { LegalAcceptModal } from './presentation/components/LegalAcceptModal'
import { LegalDocumentModal } from './presentation/components/LegalDocumentModal'

export default function App(): JSX.Element {
  return (
    <WebAuthGate>
      <AppProvider>
        <ToastProvider>
          <DialogProvider>
            <AiJobsProvider>
              <HashRouter>
                <LegalAcceptModal />
                <LegalDocumentModal />
                <FirstRunModal />
                <ToastHost />
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<StoriesPage />} />
                    <Route path="characters" element={<CharactersPage />} />
                    <Route path="costumes" element={<CostumesPage />} />
                    <Route path="scenes" element={<ScenesPage />} />
                    <Route path="props" element={<PropsPage />} />
                    <Route path="timeline" element={<TimelinePage />} />
                    <Route path="audit" element={<AuditLogPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </HashRouter>
            </AiJobsProvider>
          </DialogProvider>
        </ToastProvider>
      </AppProvider>
    </WebAuthGate>
  )
}
