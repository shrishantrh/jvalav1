import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Search, Pill } from "lucide-react";
import { whoDrugDictionary, searchDrugs, type WHODrug } from "@/data/whoDrugDictionary";

interface MedicationInputProps {
  selectedMedications: string[];
  onMedicationsChange: (medications: string[]) => void;
}

export const MedicationInput = ({ selectedMedications, onMedicationsChange }: MedicationInputProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const searchResults = searchQuery.length >= 2 ? searchDrugs(searchQuery) : [];

  const handleSelect = (drug: WHODrug) => {
    const medicationName = `${drug.drugName} (${drug.drugClass})`;
    if (!selectedMedications.includes(medicationName)) {
      onMedicationsChange([...selectedMedications, medicationName]);
    }
    setSearchQuery("");
    setOpen(false);
  };

  const handleRemove = (medication: string) => {
    onMedicationsChange(selectedMedications.filter(m => m !== medication));
  };

  const handleCustomAdd = () => {
    if (searchQuery.trim() && !selectedMedications.includes(searchQuery.trim())) {
      onMedicationsChange([...selectedMedications, searchQuery.trim()]);
      setSearchQuery("");
      setOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Pill className="w-4 h-4 text-primary" />
        <span className="text-sm font-clinical">Medications (WHO Drug Dictionary)</span>
      </div>
      
      {/* Selected medications */}
      {selectedMedications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMedications.map((med) => (
            <Badge
              key={med}
              variant="secondary"
              className="px-3 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Pill className="w-3 h-3" />
              {med}
              <button
                onClick={() => handleRemove(med)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search/Add medication */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <Search className="w-4 h-4 mr-2" />
            Search WHO Drug Dictionary...
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
                        ATC: {drug.atcCode} - {drug.atcLevel5}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">
        Search uses WHO Drug Dictionary Global with ATC classification. Supports brand names and generic names.
      </p>
    </div>
  );
};
