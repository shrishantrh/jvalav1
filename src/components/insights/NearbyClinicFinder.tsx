import { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, ExternalLink, Navigation, Star, Clock, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface Clinic {
  id: string;
  name: string;
  address: string;
  distance?: string;
  rating?: number;
  reviewCount?: number;
  phone?: string;
  specialty?: string;
  openNow?: boolean;
  url?: string;
  lat: number;
  lng: number;
}

interface NearbyClinicFinderProps {
  userConditions?: string[];
}

const CONDITION_SPECIALTIES: Record<string, string[]> = {
  'rheumatoid-arthritis': ['Rheumatologist', 'Rheumatology'],
  'migraine': ['Neurologist', 'Headache specialist'],
  'ibs': ['Gastroenterologist', 'GI specialist'],
  'eczema': ['Dermatologist'],
  'psoriasis': ['Dermatologist'],
  'asthma': ['Pulmonologist', 'Allergist'],
  'anxiety': ['Psychiatrist', 'Therapist', 'Mental health'],
  'depression': ['Psychiatrist', 'Therapist', 'Mental health'],
  'diabetes': ['Endocrinologist'],
  'fibromyalgia': ['Rheumatologist', 'Pain specialist'],
  'crohns-disease': ['Gastroenterologist'],
  'ulcerative-colitis': ['Gastroenterologist'],
  'lupus': ['Rheumatologist'],
  'pcos': ['Endocrinologist', 'OB-GYN'],
  'hypothyroidism': ['Endocrinologist'],
  'endometriosis': ['OB-GYN'],
  'gerd': ['Gastroenterologist'],
  'chronic-pain': ['Pain management', 'Pain specialist'],
  'pots': ['Cardiologist', 'Neurologist'],
  'multiple-sclerosis': ['Neurologist'],
  'ankylosing-spondylitis': ['Rheumatologist'],
};

export const NearbyClinicFinder = ({ userConditions = [] }: NearbyClinicFinderProps) => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const specialties = userConditions.flatMap(c => CONDITION_SPECIALTIES[c] || []);
  const uniqueSpecialties = [...new Set(specialties)];
  const searchQuery = uniqueSpecialties.length > 0 
    ? uniqueSpecialties[0] + ' near me'
    : 'doctor near me';

  const findClinics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearchAttempted(true);

    try {
      // Get user location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });

      // Use Nominatim to find nearby medical facilities
      const searchTerm = uniqueSpecialties.length > 0 ? uniqueSpecialties[0] : 'doctor';
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerm)}&format=json&limit=8&viewbox=${longitude - 0.1},${latitude + 0.1},${longitude + 0.1},${latitude - 0.1}&bounded=1&addressdetails=1`;
      
      const response = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'Jvala Health App' },
      });
      
      if (!response.ok) throw new Error('Search failed');
      
      const results = await response.json();
      
      const mapped: Clinic[] = results.map((r: any, i: number) => {
        const dLat = Math.abs(r.lat - latitude);
        const dLng = Math.abs(r.lon - longitude);
        const distKm = Math.sqrt(dLat ** 2 + dLng ** 2) * 111;
        const distMi = distKm * 0.621371;
        
        return {
          id: r.place_id?.toString() || String(i),
          name: r.display_name?.split(',')[0] || 'Medical Center',
          address: r.display_name?.split(',').slice(1, 4).join(',').trim() || '',
          distance: distMi < 1 ? `${Math.round(distMi * 5280)} ft` : `${distMi.toFixed(1)} mi`,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          specialty: uniqueSpecialties[0] || undefined,
        };
      });

      setClinics(mapped.slice(0, 6));
    } catch (err: any) {
      if (err.code === 1) {
        setError('Location access needed to find nearby clinics.');
      } else {
        setError('Could not find clinics. Try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [uniqueSpecialties]);

  const openDirections = (clinic: Clinic) => {
    const url = `https://maps.apple.com/?daddr=${clinic.lat},${clinic.lng}`;
    window.open(url, '_blank');
  };

  if (!searchAttempted) {
    return (
      <div className={cn(
        "p-5 rounded-2xl text-center",
        "bg-card/60 backdrop-blur-xl border border-border/30"
      )}>
        <MapPin className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-1">Find Specialists Near You</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-[280px] mx-auto">
          {uniqueSpecialties.length > 0 
            ? `Find ${uniqueSpecialties.slice(0, 2).join(' or ')} specialists based on your conditions`
            : 'Find healthcare providers in your area'}
        </p>
        <Button 
          onClick={findClinics} 
          disabled={loading}
          className="rounded-xl"
          size="sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
          Find Nearby
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "p-6 rounded-2xl text-center",
        "bg-card/60 backdrop-blur-xl border border-border/30"
      )}>
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Searching nearby...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "p-5 rounded-2xl text-center",
        "bg-card/60 backdrop-blur-xl border border-border/30"
      )}>
        <MapPin className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button onClick={findClinics} variant="outline" size="sm" className="rounded-xl">
          Try Again
        </Button>
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <div className={cn(
        "p-5 rounded-2xl text-center",
        "bg-card/60 backdrop-blur-xl border border-border/30"
      )}>
        <MapPin className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No clinics found nearby. Try expanding your search.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Nearby Specialists</h3>
        <Button onClick={findClinics} variant="ghost" size="sm" className="text-xs h-7">
          Refresh
        </Button>
      </div>
      
      {clinics.map((clinic) => (
        <button
          key={clinic.id}
          onClick={() => openDirections(clinic)}
          className={cn(
            "w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]",
            "bg-card/50 backdrop-blur-xl border border-border/20",
            "hover:border-primary/20"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{clinic.name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{clinic.address}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                {clinic.distance && (
                  <span className="flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    {clinic.distance}
                  </span>
                )}
                {clinic.specialty && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {clinic.specialty}
                  </Badge>
                )}
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
          </div>
        </button>
      ))}
    </div>
  );
};
