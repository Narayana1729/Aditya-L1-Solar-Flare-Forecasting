import os
import pandas as pd

def main():
    file_path = "data/raw/noaa/goes_flares.csv"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
        
    df = pd.read_csv(file_path)
    print(f"Total flares found in catalog: {len(df)}")
    
    # Check if goes_class exists
    if 'goes_class' not in df.columns:
        print("goes_class column not found in data.")
        return
        
    # Standardize classes
    df = df.dropna(subset=['goes_class'])
    df['class_type'] = df['goes_class'].str[0].str.upper()
    
    counts = df['class_type'].value_counts()
    print("\nCounts by class type:")
    print(counts)
    
    m_flares = df[df['class_type'] == 'M']
    x_flares = df[df['class_type'] == 'X']
    
    print(f"\nNumber of M-class flares: {len(m_flares)}")
    print(f"Number of X-class flares: {len(x_flares)}")
    
    if len(x_flares) > 0:
        print("\nFirst 10 X-class flares:")
        print(x_flares[['start_time', 'peak_time', 'end_time', 'goes_class']].head(10))
        
    if len(m_flares) > 0:
        print("\nFirst 10 M-class flares:")
        print(m_flares[['start_time', 'peak_time', 'end_time', 'goes_class']].head(10))

if __name__ == "__main__":
    main()
