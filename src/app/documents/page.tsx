'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_TYPES, getLabelByValue } from '@/utils/constants'
import { Camera, Download, Edit3, Save, Upload, FileText, Trash2, X } from 'lucide-react'

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

type DocumentRow = {
  id: string
  document_type: string
  file_name: string
  file_url: string
  description: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState('lease_agreement')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('documents')
      .select('id, document_type, file_name, file_url, description, file_size, mime_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setDocuments(data || [])
    }
    setLoading(false)
  }

  const validateFile = (selectedFile: File) => {
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      return 'Only PDF, JPG, PNG, and WebP files are allowed.'
    }

    const maxBytes = selectedFile.type === 'application/pdf' ? MAX_DOCUMENT_BYTES : MAX_IMAGE_BYTES
    if (selectedFile.size > maxBytes) {
      return selectedFile.type === 'application/pdf'
        ? 'PDF files must be 5 MB or smaller.'
        : 'Image files must be 3 MB or smaller.'
    }

    return ''
  }

  const handleFileSelection = (selectedFile: File | null) => {
    setError('')
    if (!selectedFile) {
      setFile(null)
      return
    }

    const validationError = validateFile(selectedFile)
    if (validationError) {
      setFile(null)
      setError(validationError)
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      setError('Please choose a file')
      return
    }

    setUploading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setUploading(false)
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setUploading(false)
      return
    }

    const safeFileName = sanitizeFileName(file.name)
    const path = `${user.id}/${documentType}/${new Date().getFullYear()}/${Date.now()}-${safeFileName}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('documents').insert({
      user_id: user.id,
      document_type: documentType,
      file_name: file.name,
      file_url: path,
      file_size: file.size,
      mime_type: file.type,
      description: description || null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setFile(null)
      setDescription('')
      await fetchDocuments()
    }
    setUploading(false)
  }

  const handleDownload = async (document: DocumentRow) => {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(document.file_url, 60 * 5)

    if (error) {
      setError(error.message)
      return
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const startEdit = (document: DocumentRow) => {
    setEditingId(document.id)
    setEditType(document.document_type)
    setEditDescription(document.description || '')
  }

  const saveEdit = async (documentId: string) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        document_type: editType,
        description: editDescription || null,
      })
      .eq('id', documentId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingId(null)
    setEditType('')
    setEditDescription('')
    await fetchDocuments()
  }

  const handleDelete = async (document: DocumentRow) => {
    if (!confirm(`Delete ${document.file_name}?`)) return

    const supabase = createClient()
    await supabase.storage.from('documents').remove([document.file_url])
    await supabase.from('documents').delete().eq('id', document.id)
    await fetchDocuments()
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="text-gray-500">Upload and manage compact PDFs, IDs, receipts, inspection photos, and reports</p>
        </div>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

      <form onSubmit={handleUpload} className="card p-6 space-y-4">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
          Upload limits: PDFs up to 5 MB. Images up to 3 MB. Allowed formats: PDF, JPG, PNG, WebP.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="input">
            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <div className="space-y-2">
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => handleFileSelection(event.target.files?.[0] || null)} className="input" />
            <label className="btn-secondary cursor-pointer w-full">
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
            {file && <p className="text-xs text-slate-500">Selected: {file.name} ({formatFileSize(file.size)})</p>}
          </div>
          <input value={description} onChange={(event) => setDescription(event.target.value)} className="input" placeholder="Description" />
        </div>
        <button type="submit" disabled={uploading} className="btn-primary">
          <Upload className="h-5 w-5 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>

      <div className="card">
        {loading ? (
          <div className="p-6 text-gray-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No documents uploaded yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((document) => (
              <div key={document.id} className="p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{document.file_name}</p>
                    {editingId === document.id ? (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <select value={editType} onChange={(event) => setEditType(event.target.value)} className="input">
                          {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="input" placeholder="Description" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {getLabelByValue(DOCUMENT_TYPES, document.document_type)}
                        {document.description ? ` • ${document.description}` : ''}
                        {' • '}
                        {formatFileSize(document.file_size)}
                        {document.mime_type ? ` • ${document.mime_type}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {editingId === document.id ? (
                    <>
                      <button onClick={() => saveEdit(document.id)} className="text-success-600 hover:text-success-800" aria-label="Save document changes">
                        <Save className="h-5 w-5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-800" aria-label="Cancel document edit">
                        <X className="h-5 w-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleDownload(document)} className="text-primary-600 hover:text-primary-800" aria-label="Open document">
                        <Download className="h-5 w-5" />
                      </button>
                      <button onClick={() => startEdit(document)} className="text-slate-600 hover:text-slate-800" aria-label="Edit document">
                        <Edit3 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDelete(document)} className="text-danger-600 hover:text-danger-800" aria-label="Delete document">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
