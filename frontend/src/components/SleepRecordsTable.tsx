import { formatSleepDate, formatSleepHours } from '../lib/sleepStatistics'
import { SLEEP_TYPE_OPTIONS, type SleepRecord } from '../types/sleep'
import './SleepRecordsTable.css'

type SleepRecordsTableProps = {
  records: SleepRecord[]
  today: string
  onEdit: (record: SleepRecord) => void
}

/** Kept independent of the chart bundle so records remain available if it fails. */
export default function SleepRecordsTable({
  records,
  today,
  onEdit,
}: SleepRecordsTableProps) {
  if (records.length === 0) return null

  return (
    <details className="sleep-evolution-data">
      <summary>
        Ver todos los registros <span>({records.length})</span>
      </summary>
      <div
        className="sleep-evolution-table-wrap"
        role="region"
        aria-label="Tabla de registros de sueño"
        tabIndex={0}
      >
        <table>
          <caption>Datos de la evolución del sueño</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Registro</th>
              <th scope="col">Horas</th>
              <th scope="col">Tipo</th>
              <th scope="col">Editar</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} data-sleep-row-id={record.id}>
                <th scope="row">
                  <time dateTime={record.sleepDate}>
                    {formatSleepDate(record.sleepDate)}
                  </time>
                  {record.sleepDate > today && (
                    <span className="sleep-historical-date">
                      Registro antiguo con fecha futura
                    </span>
                  )}
                </th>
                <td>#{record.id}</td>
                <td>{formatSleepHours(record.hoursSlept, true)} h</td>
                <td>
                  {SLEEP_TYPE_OPTIONS.find(
                    ({ value }) => value === record.sleepType,
                  )?.label ?? 'Sin clasificar'}
                </td>
                <td>
                  <button
                    type="button"
                    className="sleep-record-edit"
                    aria-label={`Editar registro #${record.id}`}
                    onClick={() => onEdit(record)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
