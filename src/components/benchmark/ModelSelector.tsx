import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// IMPORTANT: These IDs must match the model_name values exposed by your LiteLLM proxy.
// Current defaults align with the included litellm-config.yaml (OpenRouter).
const AVAILABLE_MODELS = [
  {
    id: "openrouter/openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenRouter",
  },
  {
    id: "openrouter/z-ai/glm-4.7-flash",
    name: "GLM 4.7 Flash",
    provider: "OpenRouter",
  },
  {
    id: "openrouter/moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "OpenRouter",
  },
];

interface ModelSelectorProps {
  selectedModels: string[];
  onChange: (models: string[]) => void;
}

const ModelSelector = ({ selectedModels, onChange }: ModelSelectorProps) => {
  const [open, setOpen] = useState(false);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      onChange(selectedModels.filter((id) => id !== modelId));
    } else {
      onChange([...selectedModels, modelId]);
    }
  };

  const removeModel = (modelId: string) => {
    onChange(selectedModels.filter((id) => id !== modelId));
  };

  const getModelName = (modelId: string) => {
    return AVAILABLE_MODELS.find((m) => m.id === modelId)?.name || modelId;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Models to Benchmark</Label>
        <span className="text-xs text-muted-foreground font-mono">
          {selectedModels.length} selected
        </span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-muted/30 border-muted hover:bg-muted/50 h-auto min-h-[42px] py-2"
          >
            <span className="text-muted-foreground text-sm">
              {selectedModels.length === 0
                ? "Select models..."
                : `${selectedModels.length} model${selectedModels.length > 1 ? "s" : ""} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="max-h-[300px] overflow-y-auto">
            {AVAILABLE_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors",
                  selectedModels.includes(model.id) && "bg-accent/50"
                )}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model.provider}
                  </span>
                </div>
                {selectedModels.includes(model.id) && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {selectedModels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedModels.map((modelId) => (
            <Badge
              key={modelId}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              {getModelName(modelId)}
              <button
                onClick={() => removeModel(modelId)}
                className="ml-1 rounded-sm p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
