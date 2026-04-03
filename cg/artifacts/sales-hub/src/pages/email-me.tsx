import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ExternalLink, RefreshCw } from "lucide-react";

const EMAIL_ME_URL = "https://nice-dune-093fa7f1e.1.azurestaticapps.net/";

export default function EmailMe() {
  const [frameKey, setFrameKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Layout>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white">My Email</h1>
              <p className="text-muted-foreground">My email workspace.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 gap-2"
              onClick={() => {
                setIsLoading(true);
                setFrameKey((current) => current + 1);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </Button>
            <Button
              asChild
              className="bg-sky-500 hover:bg-sky-400 text-white gap-2"
            >
              <a href={EMAIL_ME_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open In New Tab
              </a>
            </Button>
          </div>
        </div>

        <div className="relative rounded-3xl border border-white/8 bg-[#08111f] overflow-hidden min-h-[78vh]">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#08111f]">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
              <p className="text-sm text-sky-300">Loading My Email...</p>
            </div>
          )}

          <div className="h-[78vh] w-full overflow-auto bg-white">
            <iframe
              key={frameKey}
              src={EMAIL_ME_URL}
              title="My Email"
              className="border-0 bg-white"
              allow="microphone; camera; autoplay; clipboard-read; clipboard-write; fullscreen"
              style={{
                width: "111.11%",
                height: "86.67vh",
                transform: "scale(0.9)",
                transformOrigin: "top left",
              }}
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
