import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminGuard from './AdminGuard';
import TabBar from './TabBar';
import OrgDetail from './pages/OrgDetail';
import OrgsList from './pages/OrgsList';
import ProjectDetail from './pages/ProjectDetail';
import ProjectsList from './pages/ProjectsList';
import SearchesList from './pages/SearchesList';
import UserDetail from './pages/UserDetail';
import UsersList from './pages/UsersList';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-base font-semibold text-gray-900">Fabrick Admin</h1>
      </header>
      <TabBar />
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AdminGuard>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/orgs" element={<OrgsList />} />
            <Route path="/orgs/:id" element={<OrgDetail />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/searches" element={<SearchesList />} />
          </Routes>
        </Layout>
      </AdminGuard>
    </BrowserRouter>
  );
}
