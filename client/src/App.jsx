import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import BottomNav from './components/BottomNav.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import Home from './pages/Home.jsx'
import { PageLoading } from './components/PageState.jsx'

// Главная — единственная страница в основном бандле: с неё начинают все, и
// ждать ради неё второй сетевой запрос незачем. Остальные экраны грузятся по
// переходу, поэтому первый рендер не тащит за собой ни админку, ни ИИ-тренера.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Statistics = lazy(() => import('./pages/Statistics.jsx'))
const Programs = lazy(() => import('./pages/Programs.jsx'))
const ProgramDetail = lazy(() => import('./pages/ProgramDetail.jsx'))
const Exercises = lazy(() => import('./pages/Exercises.jsx'))
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Workouts = lazy(() => import('./pages/Workouts.jsx'))
const WorkoutBuilder = lazy(() => import('./pages/WorkoutBuilder.jsx'))
const AiWorkoutBuilder = lazy(() => import('./pages/AiWorkoutBuilder.jsx'))
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail.jsx'))
const TrainerChat = lazy(() => import('./pages/TrainerChat.jsx'))
const FoodScanner = lazy(() => import('./pages/FoodScanner.jsx'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'))
const AdminExercises = lazy(() => import('./pages/admin/AdminExercises.jsx'))
const AdminPrograms = lazy(() => import('./pages/admin/AdminPrograms.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

export default function App() {
  return (
    <div className="app">
      {/* Первая клавиатурная остановка: мимо шапки сразу к содержимому. */}
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <Navbar />
      <OfflineBanner />
      <main className="content" id="main" tabIndex={-1}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              {/* Каталоги закрыты правилами Firestore: читать их может только
                  вошедший пользователь, иначе анонимный скрипт вычитывал бы
                  873 упражнения подряд и выжигал общую суточную квоту чтений.
                  Отсюда и ProtectedRoute — без него гость упирался бы в
                  «недостаточно прав» вместо предложения войти. */}
              <Route
                path="/programs"
                element={
                  <ProtectedRoute>
                    <Programs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/programs/:id"
                element={
                  <ProtectedRoute>
                    <ProgramDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exercises"
                element={
                  <ProtectedRoute>
                    <Exercises />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exercises/:id"
                element={
                  <ProtectedRoute>
                    <ExerciseDetail />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
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
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statistics"
                element={
                  <ProtectedRoute>
                    <Statistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/nutrition"
                element={
                  <ProtectedRoute>
                    <FoodScanner />
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
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
