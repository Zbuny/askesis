import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Home from './pages/Home.jsx'
import Programs from './pages/Programs.jsx'
import ProgramDetail from './pages/ProgramDetail.jsx'
import Exercises from './pages/Exercises.jsx'
import ExerciseDetail from './pages/ExerciseDetail.jsx'
import Profile from './pages/Profile.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Workouts from './pages/Workouts.jsx'
import WorkoutBuilder from './pages/WorkoutBuilder.jsx'
import AiWorkoutBuilder from './pages/AiWorkoutBuilder.jsx'
import WorkoutDetail from './pages/WorkoutDetail.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import AdminExercises from './pages/admin/AdminExercises.jsx'
import AdminPrograms from './pages/admin/AdminPrograms.jsx'
import NotFound from './pages/NotFound.jsx'
import TrainerChat from './pages/TrainerChat.jsx'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/programs/:id" element={<ProgramDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts"
            element={
              <ProtectedRoute>
                <Workouts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/new"
            element={
              <ProtectedRoute>
                <WorkoutBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/ai"
            element={
              <ProtectedRoute>
                <AiWorkoutBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/chat"
            element={
              <ProtectedRoute>
                <TrainerChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/:id"
            element={
              <ProtectedRoute>
                <WorkoutDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts/:id/edit"
            element={
              <ProtectedRoute>
                <WorkoutBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminHome />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/exercises"
            element={
              <AdminRoute>
                <AdminExercises />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/programs"
            element={
              <AdminRoute>
                <AdminPrograms />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
