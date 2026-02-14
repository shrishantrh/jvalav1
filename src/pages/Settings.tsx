import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { ArrowLeft, LogOut, Shield, FileText, AlertTriangle, User as UserIcon, ChevronRight, Trash2, Mail, Loader2, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ThemeColorPicker } from "@/components/settings/ThemeColorPicker";
import { haptics } from "@/lib/haptics";

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


  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email, terms_accepted_at')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setUserEmail(data.email);
        setTermsAcceptedAt(data.terms_accepted_at);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };


  const termsAccepted = !!termsAcceptedAt;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

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

      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });

      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast({
        title: "Deletion failed",
        description: error.message || "Could not delete your account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  const needsAcceptance = !termsAccepted;

  return (
    <div className="fixed inset-0 flex flex-col bg-background max-w-md mx-auto">
      {/* Safe area spacer for Dynamic Island */}
      <div 
        className="flex-shrink-0 bg-background/80 backdrop-blur-xl"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />
      
      {/* Header */}
      <header className="flex-shrink-0 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              haptics.selection();
              navigate('/');
            }} 
            className="h-9 w-9 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-semibold">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-8 scrollbar-hide">
        <div className="space-y-3">
          {/* Consent Warning */}
          {needsAcceptance && (
            <Card className="border-severity-moderate glass-card">
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-severity-moderate flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">Action Required</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Please review and accept our Terms and Privacy Policy.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Theme Color Picker */}
          <ThemeColorPicker />





          {/* Legal */}
          <Card className="glass-card">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Legal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <a
                href="/#/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-2 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Terms & Privacy Policy</p>
                    {termsAccepted && (
                      <p className="text-[10px] text-severity-none">
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
          <Card className="glass-card">
            <CardContent className="p-3">
              <a
                href="mailto:support@jvala.tech"
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium">Help & Support</p>
                    <p className="text-[10px] text-muted-foreground">support@jvala.tech</p>
                  </div>
                </div>
                <Mail className="w-4 h-4 text-muted-foreground" />
              </a>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="glass-card">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {userEmail && (
                  <div className="flex items-center gap-2.5 p-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>

                <Separator className="bg-white/10 my-2" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* App version */}
          <p className="text-[10px] text-center text-muted-foreground pt-2">
            Jvala v1.0.0 • Made with 💜
          </p>
        </div>
      </main>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <p>This action is <strong>permanent and irreversible</strong>. All of the following will be deleted:</p>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li>Your profile and personal information</li>
                <li>All flare entries and health logs</li>
                <li>Medication logs and correlations</li>
                <li>AI insights and weekly reports</li>
                <li>Physician sharing links</li>
                <li>Wearable device connections</li>
              </ul>
              <p className="pt-2">Type <strong>DELETE</strong> to confirm:</p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="text-center font-mono tracking-widest"
            disabled={deleting}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText("");
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Everything"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
