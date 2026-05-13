'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_TYPES, getLabelByValue } from '@/utils/constants'
import { Camera, Upload, FileText, Trash2 } from 'lucide-react'

type DocumentRow = {
  id: string
  document_type: string
  file_name: string
  file_url: string
  description: string | null
  created_at: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState('lease_agreement')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('documents')
      .select('id, document_type, file_name, file_url, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setDocuments(data || [])
    }
    setLoading(false)
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

    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data: signedUrlData } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60)
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

    if (signedUrlData?.signedUrl) {
      window.open(signedUrlData.signedUrl, '_blank')
    }
    setUploading(false)
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
          <p className="text-gray-500">Upload and manage leases, IDs, receipts, and reports</p>
        </div>
      </div>

      {error && <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">{error}</div>}

      <form onSubmit={handleUpload} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="input">
            {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <div className="space-y-2">
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} className="input" />
            <label className="btn-secondary cursor-pointer w-full">
              <Camera className="h-5 w-5 mr-2" />
              Capture Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
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
              <div key={document.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-primary-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">{document.file_name}</p>
                    <p className="text-sm text-gray-500">{getLabelByValue(DOCUMENT_TYPES, document.document_type)}{document.description ? ` • ${document.description}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(document)} className="text-danger-600 hover:text-danger-800">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
