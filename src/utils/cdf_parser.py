import os
import cdflib
import pandas as pd
import numpy as np

def inspect_cdf(file_path):
    """
    Inspect a CDF file and print its global attributes, variables, and dimensions.
    """
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return None
        
    print(f"=== Inspecting CDF: {os.path.basename(file_path)} ===")
    try:
        cdf = cdflib.CDF(file_path)
        info = cdf.cdf_info()
        
        print(f"CDF Version: {info.get('CDF', 'Unknown')}")
        print("\nVariables:")
        for var in info.get('zVariables', []):
            var_info = cdf.varinq(var)
            print(f"  - {var}: DataType={var_info['Data_Type_Description']}, DimSizes={var_info['Dim_Sizes']}, NumRecs={var_info['Last_Rec'] + 1}")
            
        print("\nGlobal Attributes:")
        global_atts = cdf.globalattsget()
        for att, val in global_atts.items():
            print(f"  - {att}: {val}")
            
        return info
    except Exception as e:
        print(f"Error inspecting CDF file: {e}")
        return None

def cdf_to_dataframe(file_path, time_var, data_vars=None):
    """
    Convert a CDF file's variables into a pandas DataFrame.
    
    Parameters:
    -----------
    file_path : str
        Path to the CDF file.
    time_var : str
        The variable name representing time/epoch.
    data_vars : list of str, optional
        The variable names representing data columns. If None, all variables
        except the time variable are loaded (if they match the time variable dimension).
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CDF file not found: {file_path}")
        
    cdf = cdflib.CDF(file_path)
    info = cdf.cdf_info()
    variables = info.get('zVariables', [])
    
    if time_var not in variables:
        raise ValueError(f"Time variable '{time_var}' not found in CDF file. Available: {variables}")
        
    # Get times and convert to datetimes
    raw_times = cdf.varget(time_var)
    try:
        times = cdflib.cdfepoch.to_datetime(raw_times)
    except Exception as e:
        print(f"Warning: cdflib epoch conversion failed ({e}). Attempting fallback conversion.")
        # Fallback for other formats or if already parsed
        times = pd.to_datetime(raw_times)
        
    df_data = {'timestamp': times}
    
    # Identify variables to load
    if data_vars is None:
        data_vars = [v for v in variables if v != time_var]
        
    time_len = len(times)
    
    for var in data_vars:
        if var not in variables:
            print(f"Warning: Variable '{var}' not found in CDF. Skipping.")
            continue
            
        val = cdf.varget(var)
        
        # Check if the variable dimension matches the time variable (number of records)
        if len(val) != time_len:
            # If it has 1 element or is scalar, broadcast or skip
            if len(val) == 1:
                df_data[var] = val[0]
            else:
                print(f"Warning: Shape mismatch for '{var}' (length {len(val)}) vs time (length {time_len}). Skipping.")
            continue
            
        # Store in dict
        df_data[var] = val
        
    df = pd.DataFrame(df_data)
    return df
