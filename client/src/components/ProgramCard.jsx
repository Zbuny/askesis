import { Link } from 'react-router-dom'
import TiltCard from './TiltCard.jsx'

export default function ProgramCard({ program }) {
  return (
    <TiltCard as={Link} to={`/programs/${program.id}`} className="program-card">
      <h3>{program.title}</h3>
      <p>{program.level} · {program.duration}</p>
    </TiltCard>
  )
}
