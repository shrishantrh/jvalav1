import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogOut, Shield, FileText, AlertTriangle, User as UserIcon, ChevronRight, Trash2, Mail, Loader2, HelpCircle, Smartphone, Mic, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeColorPicker } from "@/components/settings/ThemeColorPicker";
import { CareTeamPanel } from "@/components/settings/CareTeamPanel";
import { VoicePicker } from "@/components/voice/VoicePicker";
import { forceRequestReview } from "@/lib/appReview";
import { haptics } from "@/lib/haptics";
import { useEngagement } from "@/hooks/useEngagement";

export default function Settings() {
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { recordFeatureEvent } = useEngagement();

  useEffect(() => {
    if (user) {
      loadUserSettings();
      recordFeatureEvent(user.id, 'settings_visit');
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('profiles').select('email, terms_accepted_at').eq('id', user.id).maybeSingle();
      if (data) { setUserEmail(data.email); setTermsAcceptedAt(data.terms_accepted_at); }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally { setLoading(false); }
  };

  const termsAccepted = !!termsAcceptedAt;

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const response = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      toast({ title: "Account deleted", description: "Your account and all associated data have been permanently deleted." });
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast({ title: "Deletion failed", description: error.message || "Could not delete your account.", variant: "destructive" });
    } finally { setDeleting(false); setShowDeleteConfirm(false); setDeleteConfirmText(""); }
  };

  const needsAcceptance = !termsAccepted;

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      <div className="flex-shrink-0 bg-background/80 backdrop-blur-xl" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      
      {/* Header */}
      <header className="flex-shrink-0 glass border-b border-border/20">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" size="icon" 
            onClick={() => { haptics.selection(); navigate('/'); }} 
            className="h-9 w-9 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-8 scrollbar-hide">
        <div className="space-y-3">
          {/* Consent Warning */}
          {needsAcceptance && (
            <Card className="glass-card border-0 rounded-2xl border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Action Required</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Please review and accept our Terms and Privacy Policy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Theme */}
          <ThemeColorPicker />

          {/* Care Team */}
          <CareTeamPanel />

          {/* Companion Voice */}
          <Card className="glass-card border-0 rounded-2xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-primary" />
                </div>
                Companion Voice
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <VoicePicker />
            </CardContent>
          </Card>

          {/* Rate Jvala */}
          <Card
            className="glass-card border-0 rounded-2xl cursor-pointer press-effect hover:bg-muted/10 transition-all"
            onClick={() => { haptics.selection(); forceRequestReview(); }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Star className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Rate Jvala</p>
                    <p className="text-[10px] text-muted-foreground">Loving the app? Tap to leave a quick review.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="glass-card border-0 rounded-2xl cursor-pointer press-effect hover:bg-muted/10 transition-all"
            onClick={() => { haptics.selection(); navigate('/shortcuts'); }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Siri & Shortcuts</p>
                    <p className="text-[10px] text-muted-foreground">Action Button, Home Screen, Siri</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Legal */}
          <Card className="glass-card border-0 rounded-2xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-3 rounded-xl hover:bg-muted/20 transition-all press-effect"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Terms & Privacy Policy</p>
                    {termsAccepted && (
                      <p className="text-[10px] text-primary">
                        ✓ Accepted {termsAcceptedAt ? new Date(termsAcceptedAt).toLocaleDateString() : ''}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          {/* Support */}
          <Card className="glass-card border-0 rounded-2xl">
            <CardContent className="p-4">
              <a href="mailto:support@jvala.tech" className="flex items-center justify-between w-full press-effect">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Help & Support</p>
                    <p className="text-[10px] text-muted-foreground">support@jvala.tech</p>
                  </div>
                </div>
                <Mail className="w-4 h-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="glass-card border-0 rounded-2xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-primary" />
                </div>
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
              {userEmail && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/10">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              )}
              
              <Button variant="outline" size="sm" className="w-full h-11 rounded-xl glass-card border-0 font-medium" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>

              <Button
                variant="ghost" size="sm"
                className="w-full h-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/8 font-medium"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Account
              </Button>
            </CardContent>
          </Card>

          {/* Replay Tour */}
          <Card className="glass-card border-0 rounded-2xl">
            <CardContent className="p-4">
              <Button
                variant="outline" size="sm"
                className="w-full h-11 rounded-xl glass-card border-0 font-medium"
                onClick={async () => {
                  if (!user) return;
                  try {
                    const { data } = await supabase.from('profiles').select('metadata').eq('id', user.id).maybeSingle();
                    const currentMeta = (data?.metadata as Record<string, any>) || {};
                    const { tour_completed, ...restMeta } = currentMeta;
                    await supabase.from('profiles').update({ 
                      tour_status: 'not_started',
                      metadata: { ...restMeta, tour_replay: true } as any,
                    }).eq('id', user.id);
                    toast({ title: "Tour will replay now" });
                    window.location.href = '/';
                    window.location.reload();
                  } catch (e) {
                    toast({ title: "Failed to reset tour", variant: "destructive" });
                  }
                }}
              >
                <HelpCircle className="w-4 h-4 mr-2" /> Replay App Tour
              </Button>
            </CardContent>
          </Card>

          <p className="text-[10px] text-center text-muted-foreground/50 pt-2 pb-4">
            Jvala v1.0.0 • Made with 💜
          </p>
        </div>
      </main>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Account
            </DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <p>This action is <strong>permanent and irreversible</strong>. All data will be deleted.</p>
              <p className="pt-2">Type <strong>DELETE</strong> to confirm:</p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="text-center font-mono tracking-widest rounded-xl"
            disabled={deleting}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} disabled={deleting} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting} className="rounded-xl">
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : "Delete Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
