import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X, Search, Pill, Plus, Edit } from "lucide-react";
import { searchDrugs, type WHODrug } from "@/data/whoDrugDictionary";

export interface MedicationDetails {
  name: string;
  drugClass?: string;
  atcCode?: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  notes?: string;
}

interface ProfileMedicationInputProps {
  medications: MedicationDetails[];
  onMedicationsChange: (medications: MedicationDetails[]) => void;
}

export const ProfileMedicationInput = ({ medications, onMedicationsChange }: ProfileMedicationInputProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMed, setEditingMed] = useState<MedicationDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  
  const searchResults = searchQuery.length >= 2 ? searchDrugs(searchQuery) : [];

  const handleSelect = (drug: WHODrug) => {
    const newMed: MedicationDetails = {
      name: drug.drugName,
      drugClass: drug.drugClass,
      atcCode: drug.atcCode,
    };
    setEditingMed(newMed);
    setSearchQuery("");
    setOpen(false);
    setDialogOpen(true);
  };

  const handleCustomAdd = () => {
    if (searchQuery.trim()) {
      const newMed: MedicationDetails = {
        name: searchQuery.trim(),
      };
      setEditingMed(newMed);
      setSearchQuery("");
      setOpen(false);
      setDialogOpen(true);
    }
  };

  const handleSaveMedication = () => {
    if (editingMed) {
      const updatedMed: MedicationDetails = {
        ...editingMed,
        dosage: dosage || undefined,
        frequency: frequency || undefined,
        startDate: startDate || undefined,
        notes: notes || undefined,
      };
      
      onMedicationsChange([...medications, updatedMed]);
      
      // Reset form
      setEditingMed(null);
      setDosage("");
      setFrequency("");
      setStartDate("");
      setNotes("");
      setDialogOpen(false);
    }
  };

  const handleRemove = (index: number) => {
    onMedicationsChange(medications.filter((_, i) => i !== index));
  };

  const handleEdit = (med: MedicationDetails, index: number) => {
    setEditingMed({ ...med });
    setDosage(med.dosage || "");
    setFrequency(med.frequency || "");
    setStartDate(med.startDate || "");
    setNotes(med.notes || "");
    setDialogOpen(true);
    // Remove old entry before updating
    onMedicationsChange(medications.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Selected medications */}
      {medications.length > 0 && (
        <div className="space-y-2">
          {medications.map((med, index) => (
            <div
              key={index}
              className="p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill className="w-4 h-4 text-primary" />
                    <span className="font-medium">{med.name}</span>
                    {med.drugClass && (
                      <Badge variant="outline" className="text-xs">
                        {med.drugClass}
                      </Badge>
                    )}
                  </div>
                  {med.dosage && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Dosage:</strong> {med.dosage}
                    </p>
                  )}
                  {med.frequency && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Frequency:</strong> {med.frequency}
                    </p>
                  )}
                  {med.startDate && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Started:</strong> {med.startDate}
                    </p>
                  )}
                  {med.notes && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Notes:</strong> {med.notes}
                    </p>
                  )}
                  {med.atcCode && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ATC Code: {med.atcCode}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(med, index)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(index)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search/Add medication */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <Plus className="w-4 h-4 mr-2" />
            Add Medication from WHO Drug Dictionary
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Search medications (e.g., Ibuprofen, Humira)..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {searchQuery.length < 2 ? (
                <CommandEmpty>Type at least 2 characters to search...</CommandEmpty>
              ) : searchResults.length === 0 ? (
                <CommandEmpty>
                  <div className="space-y-2 py-2">
                    <p className="text-sm">No matching medications found in WHO Drug Dictionary</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCustomAdd}
                      className="w-full"
                    >
                      Add "{searchQuery}" as custom medication
                    </Button>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup heading={`${searchResults.length} medications found`}>
                  {searchResults.slice(0, 10).map((drug) => (
                    <CommandItem
                      key={drug.id}
                      value={drug.drugName}
                      onSelect={() => handleSelect(drug)}
                      className="flex flex-col items-start py-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Pill className="w-4 h-4 text-primary" />
                        <span className="font-medium">{drug.drugName}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {drug.drugClass}
                        </Badge>
                      </div>
                      {drug.commonNames.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-6">
                          Also known as: {drug.commonNames.slice(0, 3).join(", ")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-6 mt-1">
                        ATC: {drug.atcCode}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Medication Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medication Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Medication Name</Label>
              <Input value={editingMed?.name || ""} disabled className="bg-muted" />
              {editingMed?.drugClass && (
                <Badge variant="outline" className="mt-2">
                  {editingMed.drugClass}
                </Badge>
              )}
            </div>
            
            <div>
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 200mg, 1 tablet"
              />
            </div>
            
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g., Twice daily, As needed"
              />
            </div>
            
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSaveMedication} className="flex-1">
                Save Medication
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDialogOpen(false);
                  setEditingMed(null);
                  setDosage("");
                  setFrequency("");
                  setStartDate("");
                  setNotes("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        Search uses WHO Drug Dictionary Global with ATC classification
      </p>
    </div>
  );
};