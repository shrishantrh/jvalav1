import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import { Pill, Plus, Check, Clock, Calendar, TrendingUp, X, Search } from 'lucide-react';
import { searchDrugs, type WHODrug } from "@/data/whoDrugDictionary";
import { format, subDays, eachDayOfInterval, isToday, isSameDay } from 'date-fns';

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface MedicationTrackerProps {
  logs: MedicationLog[];
  onLogMedication: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
}

const FREQUENCIES = [
  { value: 'as-needed', label: 'As needed' },
  { value: 'once-daily', label: 'Once daily' },
  { value: 'twice-daily', label: 'Twice daily' },
  { value: 'three-daily', label: '3x daily' },
  { value: 'weekly', label: 'Weekly' },
];

export const MedicationTracker = ({ logs, onLogMedication, userMedications = [] }: MedicationTrackerProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("as-needed");

  const searchResults = searchQuery.length >= 2 ? searchDrugs(searchQuery) : [];

  // Calculate adherence for the last 7 days
  const adherenceData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    const dailyLogs = last7Days.map(day => {
      const dayLogs = logs.filter(log => isSameDay(new Date(log.takenAt), day));
      return {
        date: day,
        label: format(day, 'EEE'),
        count: dayLogs.length,
        logged: dayLogs.length > 0
      };
    });

    const adherenceRate = dailyLogs.filter(d => d.logged).length / 7 * 100;

    return { dailyLogs, adherenceRate };
  }, [logs]);

  // Get unique medications from logs
  const recentMedications = useMemo(() => {
    const meds = new Map<string, { count: number; lastTaken: Date }>();
    logs.forEach(log => {
      const existing = meds.get(log.medicationName);
      if (!existing || log.takenAt > existing.lastTaken) {
        meds.set(log.medicationName, {
          count: (existing?.count || 0) + 1,
          lastTaken: new Date(log.takenAt)
        });
      }
    });
    return Array.from(meds.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
  }, [logs]);

  const handleSelectDrug = (drug: WHODrug) => {
    setSelectedMed(`${drug.drugName} (${drug.drugClass})`);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const handleQuickLog = (medName: string) => {
    onLogMedication({
      medicationName: medName,
      dosage: 'standard',
      frequency: 'as-needed'
    });
  };

  const handleSubmit = () => {
    if (!selectedMed) return;
    onLogMedication({
      medicationName: selectedMed,
      dosage: dosage || 'standard',
      frequency
    });
    setSelectedMed("");
    setDosage("");
    setFrequency("as-needed");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Adherence Overview */}
      <Card className="bg-gradient-card border-0 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            7-Day Medication Adherence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <Progress value={adherenceData.adherenceRate} className="flex-1 h-2" />
            <span className="text-lg font-bold">{Math.round(adherenceData.adherenceRate)}%</span>
          </div>
          
          <div className="flex justify-between">
            {adherenceData.dailyLogs.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                  day.logged 
                    ? 'bg-severity-none/20 text-severity-none' 
                    : isToday(day.date)
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {day.logged ? <Check className="w-4 h-4" /> : day.count}
                </div>
                <span className="text-xs text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Log Section */}
      {(recentMedications.length > 0 || userMedications.length > 0) && (
        <Card className="bg-gradient-card border-0 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Quick Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentMedications.map(([name]) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickLog(name)}
                  className="text-xs"
                >
                  <Pill className="w-3 h-3 mr-1" />
                  {name.split(' (')[0]}
                </Button>
              ))}
              {userMedications.slice(0, 3).map(med => (
                !recentMedications.find(([n]) => n === med) && (
                  <Button
                    key={med}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickLog(med)}
                    className="text-xs"
                  >
                    <Pill className="w-3 h-3 mr-1" />
                    {med.split(' (')[0]}
                  </Button>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Medication Form */}
      {showAddForm ? (
        <Card className="bg-gradient-card border-0 shadow-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Log Medication</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Medication Search */}
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Search className="w-4 h-4 mr-2" />
                  {selectedMed || "Search medication..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search WHO Drug Dictionary..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    {searchQuery.length < 2 ? (
                      <CommandEmpty>Type at least 2 characters...</CommandEmpty>
                    ) : searchResults.length === 0 ? (
                      <CommandEmpty>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedMed(searchQuery);
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                          className="w-full"
                        >
                          Add "{searchQuery}" as custom
                        </Button>
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {searchResults.slice(0, 8).map((drug) => (
                          <CommandItem
                            key={drug.id}
                            onSelect={() => handleSelectDrug(drug)}
                            className="cursor-pointer"
                          >
                            <Pill className="w-4 h-4 mr-2 text-primary" />
                            <span>{drug.drugName}</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                              {drug.drugClass}
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Dosage & Frequency */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Dosage (e.g., 200mg)"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={!selectedMed}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Log Medication
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button 
          onClick={() => setShowAddForm(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log New Medication
        </Button>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card className="bg-gradient-card border-0 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{log.medicationName.split(' (')[0]}</p>
                      <p className="text-xs text-muted-foreground">{log.dosage}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.takenAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
