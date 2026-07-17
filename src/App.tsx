import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './presentation/context/AppContext'
import { Layout } from './presentation/components/Layout'
import { StoriesPage } from './presentation/pages/StoriesPage'
import { CharactersPage } from './presentation/pages/CharactersPage'
import { ScenesPage } from './presentation/pages/ScenesPage'
import { PropsPage } from './presentation/pages/PropsPage'
import { TimelinePage } from './presentation/pages/TimelinePage'
import { SettingsPage } from './presentation/pages/SettingsPage'
import { FirstRunModal } from './presentation/components/FirstRunModal'

export default function App(): JSX.Element {
  return (
    <AppProvider>
      <HashRouter>
        <FirstRunModal />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<StoriesPage />} />
            <Route path="characters" element={<CharactersPage />} />
            <Route path="scenes" element={<ScenesPage />} />
            <Route path="props" element={<PropsPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
