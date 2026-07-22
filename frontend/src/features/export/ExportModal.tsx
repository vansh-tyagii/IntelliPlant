import React, { useState } from 'react'
import { Modal, Tabs, Button, message } from 'antd'
import { Download, FileJson, FileSpreadsheet, File } from 'lucide-react'
import { useExport } from '@/hooks/useExport'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  data: unknown
  title: string
  filename: string
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onClose, data, title, filename }) => {
  const { exportAsJson, exportAsCsv, exportAsPdf } = useExport()
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    setExporting(format)
    try {
      if (format === 'json') {
        exportAsJson(data, filename)
        message.success('JSON exported successfully')
      } else if (format === 'csv') {
        const flat = Array.isArray(data) ? data : [data as Record<string, unknown>]
        exportAsCsv(flat as Record<string, unknown>[], filename)
        message.success('CSV exported successfully')
      } else {
        await exportAsPdf('export-report-template', filename)
        message.success('PDF exported successfully')
      }
    } catch {
      message.error(`Export failed: ${format}`)
    } finally {
      setExporting(null)
    }
  }

  const items = [
    {
      key: 'json',
      label: <span className="flex items-center gap-1.5"><FileJson size={14} /> JSON</span>,
      children: (
        <div className="p-4 space-y-3">
          <p className="font-sans text-sm text-[#c2c6d8]">Export raw data as structured JSON. Suitable for API integration and further processing.</p>
          <pre className="bg-[#0b0e16] border border-[#424656] p-3 rounded text-[10px] font-mono text-[#b3c5ff] overflow-auto max-h-48">
            {JSON.stringify(data, null, 2).slice(0, 500)}{JSON.stringify(data).length > 500 ? '\n...' : ''}
          </pre>
          <Button type="primary" icon={<Download size={14} />} onClick={() => handleExport('json')} loading={exporting === 'json'}>
            Download JSON
          </Button>
        </div>
      ),
    },
    {
      key: 'csv',
      label: <span className="flex items-center gap-1.5"><FileSpreadsheet size={14} /> CSV</span>,
      children: (
        <div className="p-4 space-y-3">
          <p className="font-sans text-sm text-[#c2c6d8]">Export as CSV. Best for spreadsheet analysis and reporting tools.</p>
          <Button type="primary" icon={<Download size={14} />} onClick={() => handleExport('csv')} loading={exporting === 'csv'}>
            Download CSV
          </Button>
        </div>
      ),
    },
    {
      key: 'pdf',
      label: <span className="flex items-center gap-1.5"><File size={14} /> PDF</span>,
      children: (
        <div className="p-4 space-y-3">
          <p className="font-sans text-sm text-[#c2c6d8]">Export as a formatted PDF report. Suitable for incident documentation and regulatory submission.</p>
          {/* Hidden printable template */}
          <div id="export-report-template" className="bg-white p-8 text-black rounded hidden">
            <h1 className="text-2xl font-bold mb-4">Sentinel Safety Platform — {title}</h1>
            <p className="text-sm text-gray-500 mb-6">Generated: {new Date().toLocaleString()}</p>
            <pre className="text-xs bg-gray-100 p-4 rounded whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          </div>
          <Button type="primary" icon={<Download size={14} />} onClick={() => handleExport('pdf')} loading={exporting === 'pdf'}>
            Download PDF
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div className="flex items-center gap-2">
          <Download size={16} className="text-[#b3c5ff]" />
          <span className="text-[#e1e2ee] font-display font-semibold">Export — {title}</span>
        </div>
      }
      width={560}
    >
      <Tabs items={items} />
    </Modal>
  )
}
