import pandas as pd

df = pd.read_csv('../subjects_export.csv')
with open('out.log', 'w', encoding='utf-8') as f:
    f.write(f"Columns: {list(df.columns)}\n\n")
    f.write(f"First 2 rows data:\n")
    for r in df.head(2).to_dict('records'):
        f.write(f"{r}\n")
    
    # Check if 'semester' column exists and has non-null values
    if 'semester' in df.columns:
        valid_sems = df['semester'].dropna()
        f.write(f"\nNon-null semesters count: {len(valid_sems)} / {len(df)}\n")
        if len(valid_sems) > 0:
            f.write(f"Sample semesters: {list(valid_sems.head())}\n")
    else:
        f.write("\nNo 'semester' column found!\n")

