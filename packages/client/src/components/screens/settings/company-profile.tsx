import { useCallback, useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { Building2, Check, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from 'urql';
import { useWorkspace } from '../../../providers/workspace-provider.js';
import { Button } from '../../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';

const UPDATE_WORKSPACE = `
  mutation UpdateWorkspaceSettings($input: UpdateWorkspaceSettingsInput!) {
    updateWorkspaceSettings(input: $input) {
      id companyName logoUrl
    }
  }
`;

const UPLOAD_LOGO = `
  mutation UploadWorkspaceLogo($fileBase64: String!, $mimeType: String!) {
    uploadWorkspaceLogo(fileBase64: $fileBase64, mimeType: $mimeType) {
      id companyName logoUrl
    }
  }
`;

const REMOVE_LOGO = `
  mutation RemoveWorkspaceLogo {
    removeWorkspaceLogo {
      id companyName logoUrl
    }
  }
`;

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URI prefix - server rebuilds it from mimeType
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface LogoPreviewProps {
  src: string | null;
  companyName: string;
  uploading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function LogoPreview({
  src,
  companyName,
  uploading,
  onUpload,
  onRemove,
  fileInputRef,
}: LogoPreviewProps): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 shrink-0 overflow-hidden">
        {uploading ? (
          <Loader2 className="animate-spin text-slate-400" size={24} />
        ) : src ? (
          <img
            src={src}
            alt={companyName || 'Logo preview'}
            className="w-full h-full object-contain"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Building2 size={24} className="text-slate-300" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} />
            {src ? 'Replace' : 'Upload logo'}
          </Button>
          {src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={uploading}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 size={14} />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400">
          JPEG, PNG, GIF, WEBP or SVG - max 2 MB. Recommended: 256x256 px.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={onUpload}
        aria-label="Upload workspace logo"
      />
    </div>
  );
}

export function CompanyProfile(): JSX.Element {
  const { workspace, isLoading: wsLoading, refetch } = useWorkspace();
  const [{ fetching: saving }, updateSettings] = useMutation(UPDATE_WORKSPACE);
  const [{ fetching: uploading }, uploadLogo] = useMutation(UPLOAD_LOGO);
  const [{ fetching: removing }, removeLogo] = useMutation(REMOVE_LOGO);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (workspace) {
      setCompanyName(workspace.companyName || '');
      setLogoUrl(workspace.logoUrl || '');
      setPreviewUrl(null);
      setDirty(false);
    }
  }, [workspace]);

  const handleFileUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!e.target) return;
      // Reset input so the same file can be re-selected
      (e.target as HTMLInputElement).value = '';

      if (!file) return;

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error('Unsupported file type. Use JPEG, PNG, GIF, WEBP or SVG.');
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error('File too large. Maximum size is 2 MB.');
        return;
      }

      // Show local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      let base64: string;
      try {
        base64 = await fileToBase64(file);
      } catch {
        toast.error('Failed to read file');
        URL.revokeObjectURL(objectUrl);
        setPreviewUrl(null);
        return;
      }

      const result = await uploadLogo({ fileBase64: base64, mimeType: file.type });
      URL.revokeObjectURL(objectUrl);

      if (result.error) {
        toast.error('Upload failed: ' + result.error.message);
        setPreviewUrl(null);
      } else {
        toast.success('Logo uploaded');
        setPreviewUrl(null);
        refetch();
      }
    },
    [uploadLogo, refetch],
  );

  const handleRemoveLogo = useCallback(async () => {
    const result = await removeLogo({});
    if (result.error) {
      toast.error('Failed to remove logo: ' + result.error.message);
    } else {
      toast.success('Logo removed');
      setLogoUrl('');
      setPreviewUrl(null);
      refetch();
    }
  }, [removeLogo, refetch]);

  const handleSave = useCallback(async () => {
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    const result = await updateSettings({
      input: {
        companyName: companyName.trim(),
        logoUrl: logoUrl.trim() || null,
      },
    });
    if (result.error) {
      toast.error('Failed to save: ' + result.error.message);
    } else {
      toast.success('Company profile saved');
      setDirty(false);
      refetch();
    }
  }, [companyName, logoUrl, updateSettings, refetch]);

  if (wsLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-slate-400" size={24} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayLogoSrc = previewUrl || logoUrl || null;
  const isUploading = uploading || removing;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>
            How your company appears across the workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Workspace Logo</Label>
              <LogoPreview
                src={displayLogoSrc}
                companyName={companyName}
                uploading={isUploading}
                onUpload={handleFileUpload}
                onRemove={handleRemoveLogo}
                fileInputRef={fileInputRef}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (advanced)</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={e => {
                  setLogoUrl(e.target.value);
                  setPreviewUrl(null);
                  setDirty(true);
                }}
                placeholder="https://example.com/logo.png"
                type="url"
              />
              <p className="text-xs text-slate-500">
                Optional: paste a URL if you prefer not to upload. File upload above takes priority.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={e => {
                  setCompanyName(e.target.value);
                  setDirty(true);
                }}
                placeholder="e.g. Wright Ltd."
                aria-required="true"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty || !companyName.trim()}
        >
          {saving ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Check size={16} />
          )}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
