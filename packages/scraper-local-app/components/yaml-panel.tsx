'use client';

import { useRef } from 'react';
import { Download, FileCode, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScraperConfig } from '@/lib/types';
import { configToYaml, downloadYaml, yamlToConfig } from '@/lib/yaml-utils';

interface YamlPanelProps {
  config: ScraperConfig;
  onImport: (config: ScraperConfig) => void;
}

export function YamlPanel({ config, onImport }: YamlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadYaml(config);
    toast.success('Configuration exported successfully');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedConfig = yamlToConfig(text);
      onImport(importedConfig);
      toast.success('Configuration imported successfully');
    } catch (error) {
      toast.error('Failed to parse YAML file');
      console.error(error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const yamlPreview = configToYaml(config);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <FileCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Configuration File</CardTitle>
            <CardDescription>Import or export your configuration as YAML</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Export YAML
          </Button>
          <Button variant="outline" onClick={handleImportClick} className="flex-1">
            <Upload className="mr-2 h-4 w-4" />
            Import YAML
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {config.accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Preview</p>
            <pre className="p-4 rounded-lg bg-secondary/50 text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
              {yamlPreview}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
