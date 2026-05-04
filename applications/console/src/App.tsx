import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import CliAuth from './pages/CliAuth';
import Login from './pages/Login';
import OrgDetail from './pages/OrgDetail';
import OrgList from './pages/OrgList';
import OrgSettings from './pages/OrgSettings';
import ProjectDetail from './pages/ProjectDetail';
import ProjectSettings from './pages/ProjectSettings';
import Register from './pages/Register';

function RedirectOrgEdit() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <Navigate to={`/orgs/${orgSlug}/settings`} replace />;
}

function RedirectProjectEdit() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  return <Navigate to={`/orgs/${orgSlug}/projects/${projectSlug}/settings`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cli-auth" element={<RequireAuth><CliAuth /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><OrgList /></RequireAuth>} />
          <Route path="/orgs/:orgSlug" element={<RequireAuth><OrgDetail /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/edit" element={<RequireAuth><RedirectOrgEdit /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/settings" element={<RequireAuth><OrgSettings /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/projects/:projectSlug" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/projects/:projectSlug/edit" element={<RequireAuth><RedirectProjectEdit /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/projects/:projectSlug/settings" element={<RequireAuth><ProjectSettings /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
