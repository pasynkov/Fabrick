import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import CliAuth from './pages/CliAuth';
import EditOrgName from './pages/EditOrgName';
import EditProjectName from './pages/EditProjectName';
import Login from './pages/Login';
import OrgDetail from './pages/OrgDetail';
import OrgList from './pages/OrgList';
import ProjectDetail from './pages/ProjectDetail';
import Register from './pages/Register';

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
          <Route path="/orgs/:orgSlug/edit" element={<RequireAuth><EditOrgName /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/projects/:projectSlug" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
          <Route path="/orgs/:orgSlug/projects/:projectSlug/edit" element={<RequireAuth><EditProjectName /></RequireAuth>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
