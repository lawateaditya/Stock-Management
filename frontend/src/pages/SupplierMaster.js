import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '@/utils/api';
import { toast } from 'sonner';
import Papa from 'papaparse';

// Country, State, City Data
const COUNTRY_STATE_CITY = {
  'India': {
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun'],
    'Assam': ['Guwahati', 'Silchar', 'Dibrugarh'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur'],
    'Chhattisgarh': ['Raipur', 'Bilaspur', 'Durg'],
    'Goa': ['Panaji', 'Margao'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
    'Haryana': ['Faridabad', 'Gurgaon', 'Hisar'],
    'Himachal Pradesh': ['Shimla', 'Mandi'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
    'Karnataka': ['Bangalore', 'Mysore', 'Mangalore', 'Hubli'],
    'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode'],
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Aurangabad'],
    'Manipur': ['Imphal'],
    'Meghalaya': ['Shillong'],
    'Mizoram': ['Aizawl'],
    'Nagaland': ['Kohima'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
    'Punjab': ['Chandigarh', 'Ludhiana', 'Amritsar'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Ajmer'],
    'Sikkim': ['Gangtok'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem'],
    'Telangana': ['Hyderabad', 'Secunderabad'],
    'Tripura': ['Agartala'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi'],
    'Uttarakhand': ['Dehradun', 'Nainital'],
    'West Bengal': ['Kolkata', 'Darjeeling', 'Siliguri']
  },
  'United States': {
    'California': ['Los Angeles', 'San Francisco', 'San Diego'],
    'Texas': ['Houston', 'Dallas', 'Austin'],
    'New York': ['New York City', 'Buffalo', 'Albany'],
    'Florida': ['Miami', 'Orlando', 'Tampa']
  },
  'United Kingdom': {
    'England': ['London', 'Manchester', 'Birmingham'],
    'Scotland': ['Edinburgh', 'Glasgow'],
    'Wales': ['Cardiff', 'Swansea']
  }
};

const SupplierMaster = () => {
  const [user, setUser] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [countries] = useState(Object.keys(COUNTRY_STATE_CITY));

  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    email: '',
    phone: '',
    country: '',
    state: '',
    city: '',
    address: '',
    pincode: '',
  });

  useEffect(() => {
    fetchUser();
    fetchSuppliers();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      toast.error('Failed to fetch user data');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch {
      toast.error('Failed to fetch suppliers');
    }
  };

  const handleCSVUpload = () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;

        const requiredHeaders = ['supplier_name', 'contact_person', 'email', 'phone', 'country', 'state', 'city'];
        const fileHeaders = Object.keys(rows[0] || {});
        const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));

        if (missingHeaders.length > 0) {
          toast.error(`Missing headers: ${missingHeaders.join(', ')}`);
          return;
        }

        try {
          for (const row of rows) {
            await api.post('/suppliers', {
              supplier_name: row.supplier_name,
              contact_person: row.contact_person,
              email: row.email,
              phone: row.phone,
              country: row.country,
              state: row.state,
              city: row.city,
              address: row.address || '',
              pincode: row.pincode || '',
            });
          }

          toast.success('CSV suppliers imported successfully');
          setCsvFile(null);
          fetchSuppliers();
        } catch {
          toast.error('Error importing CSV suppliers');
        }
      },
      error: () => toast.error('Failed to parse CSV file'),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, {
          supplier_name: formData.supplier_name,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          country: formData.country,
          state: formData.state,
          city: formData.city,
          address: formData.address,
          pincode: formData.pincode,
        });
        toast.success('Supplier updated successfully');
        setIsDialogOpen(false);
        resetForm();
      } else {
        await api.post('/suppliers', formData);
        toast.success('Supplier created successfully');
        resetForm();
      }
      fetchSuppliers();
    } catch (error) {
      const errorMsg = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Operation failed';
      toast.error(errorMsg);
    }
  };

  const handleCreateAndAddMore = async () => {
    try {
      await api.post('/suppliers', formData);
      toast.success('Supplier created successfully');
      resetForm();
      fetchSuppliers();
    } catch (error) {
      const errorMsg = typeof error.response?.data?.detail === 'string' 
        ? error.response.data.detail 
        : 'Operation failed';
      toast.error(errorMsg);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person,
      email: supplier.email,
      phone: supplier.phone,
      country: supplier.country,
      state: supplier.state,
      city: supplier.city,
      address: supplier.address || '',
      pincode: supplier.pincode || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: '',
      contact_person: '',
      email: '',
      phone: '',
      country: '',
      state: '',
      city: '',
      address: '',
      pincode: '',
    });
    setEditingSupplier(null);
  };

  const getStates = () => {
    return formData.country ? Object.keys(COUNTRY_STATE_CITY[formData.country]) : [];
  };

  const getCities = () => {
    if (formData.country && formData.state) {
      return COUNTRY_STATE_CITY[formData.country][formData.state] || [];
    }
    return [];
  };

  if (!user) return <div>Loading...</div>;

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Supplier Master</h2>
            <p className="text-gray-600">Manage your suppliers</p>
          </div>

          <div className="flex gap-2 items-center">
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>

            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csvUpload"
              onChange={(e) => setCsvFile(e.target.files[0])}
            />

            <Button
              variant="outline"
              onClick={() => document.getElementById('csvUpload').click()}
            >
              Upload CSV
            </Button>

            <Button
              variant="secondary"
              onClick={handleCSVUpload}
              disabled={!csvFile}
            >
              Import
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>State</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map(supplier => (
                <TableRow key={supplier.id}>
                  <TableCell>{supplier.supplier_name}</TableCell>
                  <TableCell>{supplier.contact_person}</TableCell>
                  <TableCell>{supplier.email}</TableCell>
                  <TableCell>{supplier.phone}</TableCell>
                  <TableCell>{supplier.country}</TableCell>
                  <TableCell>{supplier.state}</TableCell>
                  <TableCell>{supplier.city}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No suppliers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              <DialogDescription>
                {editingSupplier ? 'Update supplier details' : 'Add a new supplier'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Supplier Name</Label>
                  <Input
                    value={formData.supplier_name}
                    onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Contact Person</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Country</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => {
                      setFormData({ ...formData, country: value, state: '', city: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>State/Province</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => {
                      setFormData({ ...formData, state: value, city: '' });
                    }}
                    disabled={!formData.country}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {getStates().map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>City</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => {
                      setFormData({ ...formData, city: value });
                    }}
                    disabled={!formData.state}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCities().map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={formData.pincode}
                    onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                {!editingSupplier && (
                  <Button 
                    type="button"
                    variant="secondary"
                    onClick={handleCreateAndAddMore}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create & Add More
                  </Button>
                )}
                <Button type="submit">
                  {editingSupplier ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SupplierMaster;
