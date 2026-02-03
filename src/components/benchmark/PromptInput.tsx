import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

const PromptInput = ({ value, onChange }: PromptInputProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="prompt" className="text-sm font-medium">
          Creative Writing Prompt
        </Label>
        <span className="text-xs text-muted-foreground font-mono">
          {value.length} chars
        </span>
      </div>
      <Textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a creative writing prompt to benchmark theme coherence across models..."
        className="min-h-[140px] resize-none bg-muted/30 border-muted font-mono text-sm placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
      />
      <p className="text-xs text-muted-foreground">
        Tip: Complex prompts with specific themes yield more differentiated results.
      </p>
    </div>
  );
};

export default PromptInput;
