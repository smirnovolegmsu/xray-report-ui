'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function XrayConfigViewer() {
  const [config, setConfig] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && !config) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getXrayConfig();
      const configData = response.data;
      setConfig(JSON.stringify(configData, null, 2));
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(config);
    toast.success('Configuration copied to clipboard');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <CardTitle className="text-lg">Xray Configuration</CardTitle>
              {isOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="h-[300px] bg-muted animate-pulse rounded"></div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4 overflow-auto max-h-[500px]">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {config}
                  </pre>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
