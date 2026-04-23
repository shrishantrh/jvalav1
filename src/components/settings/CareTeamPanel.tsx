import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, UserPlus, Trash2, Loader2, Mail, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Link {
  id: string;
  clinician_id: string | null;
  invited_email: string | null;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  access_level: string;
  clinician_name?: string | null;
}

export function CareTeamPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const sb = supabase as any;
    const { data } = await sb.from('patient_clinician_links').select('*').eq('patient_id', user.id).order('invited_at', { ascending: false });
    const enriched: Link[] = [];
    for (const l of (data || [])) {
      let clinician_name = null;
      if (l.clinician_id) {
        const { data: cp } = await sb.from('clinician_profiles').select('full_name').eq('id', l.clinician_id).maybeSingle();
        clinician_name = cp?.full_name;
      }
      enriched.push({ ...l, clinician_name });
    }
    setLinks(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return;
    setInviting(true);
    try {
      const sb = supabase as any;
      // Check duplicates
      const { data: existing } = await sb.from('patient_clinician_links')
        .select('id')
        .eq('patient_id', user.id)
        .eq('invited_email', inviteEmail.trim().toLowerCase())
        .maybeSingle();
      if (existing) {
        toast({ title: 'Already invited', description: 'You already invited this email.' });
        setInviting(false);
        return;
      }
      const { error } = await sb.from('patient_clinician_links').insert({
        patient_id: user.id,
        invited_email: inviteEmail.trim().toLowerCase(),
        status: 'pending',
        access_level: 'full',
        invitation_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      if (error) throw error;
      toast({ title: 'Invitation sent', description: 'Your provider will see your record once they create their Jvala account with this email.' });
      setInviteEmail('');
      load();
    } catch (e: any) {
      toast({ title: 'Invite failed', description: e.message, variant: 'destructive' });
    } finally { setInviting(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this provider\'s access? They will no longer see your data.')) return;
    const sb = supabase as any;
    await sb.from('patient_clinician_links').delete().eq('id', id);
    toast({ title: 'Access revoked' });
    load();
  };

  return (
    <Card className="glass-card border-0 rounded-2xl">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-primary" />
          </div>
          Care Team
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        <p className="text-xs text-muted-foreground">
          Invite your doctor by email. When they create a Jvala provider account using that email, they'll automatically see your data — flares, meds, alerts.
        </p>

        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="doctor@clinic.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            disabled={inviting}
          />
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-1.5" />Invite</>}
          </Button>
        </div>

        <div className="space-y-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto my-3" />
          ) : links.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No providers connected yet.</p>
          ) : (
            links.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {l.clinician_name || l.invited_email}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px]">
                        {l.status === 'active' ? <><Check className="w-2.5 h-2.5 mr-0.5" />Active</> : l.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {l.status === 'active' && l.accepted_at
                          ? `Connected ${new Date(l.accepted_at).toLocaleDateString()}`
                          : `Invited ${new Date(l.invited_at).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(l.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
