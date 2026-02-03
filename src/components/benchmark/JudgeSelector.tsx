import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// IMPORTANT: IDs must match the model_name values exposed by your LiteLLM proxy.
const JUDGE_MODELS = [
  { id: "openrouter/openai/gpt-4o-mini", name: "GPT-4o Mini", description: "Recommended" },
  { id: "openrouter/z-ai/glm-4.7-flash", name: "GLM 4.7 Flash", description: "Fast" },
  { id: "openrouter/moonshotai/kimi-k2.5", name: "Kimi K2.5", description: "Alternative" },
];

interface JudgeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const JudgeSelector = ({ value, onChange }: JudgeSelectorProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Judge Model</Label>
        <span className="text-xs text-muted-foreground">
          Evaluates outputs
        </span>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-muted/30 border-muted focus:ring-1 focus:ring-primary/50">
          <SelectValue placeholder="Select judge model" />
        </SelectTrigger>
        <SelectContent>
          {JUDGE_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <span>{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({model.description})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default JudgeSelector;
