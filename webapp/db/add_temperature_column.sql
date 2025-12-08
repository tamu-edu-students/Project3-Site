-- Migration script to add "Order Temperature" column to orderitems table
-- Run this script if the column doesn't exist in your database

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orderitems' 
        AND column_name = 'Order Temperature'
    ) THEN
        ALTER TABLE public.orderitems 
        ADD COLUMN "Order Temperature" VARCHAR(50);
        
        RAISE NOTICE 'Column "Order Temperature" added successfully';
    ELSE
        RAISE NOTICE 'Column "Order Temperature" already exists';
    END IF;
END $$;

