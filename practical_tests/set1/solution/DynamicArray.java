public class DynamicArray {
    public static void main(String[] arg) {
        String[] ordinaryStringArray = {"Today", "is", "Saturday", "How", "do", "you", "do"};
        
        System.out.println("Construct the array");
        DynamicArray d = new DynamicArray(ordinaryStringArray);
        System.out.println(d);

        System.out.println("\nAdd element");
        d.add("?");
        System.out.println(d);

        System.out.println("\nGet the element at 5: " + d.get(5));
        System.out.println("\nGet the element at -1: " + d.get(-1));

        System.out.println("\nAdd string array");
        String[] newString = {"Yes", "it", "is", "good"};
        d.add(newString);
        System.out.println(d);

        System.out.println("\nResize the array to size 5");
        d.resize(5);
        System.out.println(d);
        System.out.println("\nGet the element at 6: " + d.get(6));
        System.out.println("\nResize the array to size 10");
        d.resize(10);
        System.out.println(d);
    }


    private String[] arr;
    private int size;


    public String toString() {
        String result = "size = " + size ;
        for (int i = 0; i < size; i++)
            result += "\n" + i + "\t" + arr[i];
        return result;
    }
    public DynamicArray(String[] arg) {
        arr = new String[arg.length];
        size = 0;
        add(arg);       
    }
    public String get(int index) {
        if (index < 0 || index >= size)
            return "-----";
        return arr[index];
    }
    public int size() {
        return size;
    }
    public void resize(int newSize) {
        if (newSize <= arr.length) { //good, no need to resize array
            ;
        } else {
            String[] newArr = new String[newSize];
            for (int i = 0; i < arr.length; i++)
                newArr[i] = arr[i];
            arr = newArr;
        }
        size = newSize;
    }
    public void add(String s) {
        if (arr.length <= size) { //need to resize
            resize(size + 1);
            size--;
        } 
        arr[size++] = s;
    }
    public void add(String[] s) {
        for (int i = 0; i < s.length; i++)
            add(s[i]);
    }

}