;;; Fixups to the standard library to get around incompatibilities in primitives,
;;; mostly related to the lack of mutable strings

(def map (f . seqs)
  (if (some [isa _ 'string] seqs)
        ; Doesn't even work in reference implementation...I wonder why I bother ;-)
       (withs (n   (apply min (map len seqs))
               lists (map [coerce _ 'cons] seqs))
         (apply f lists))
      (no (cdr seqs)) 
       (map1 f (car seqs))
      ((afn (seqs)
        (if (some no seqs)  
            nil
            (cons (apply f (map1 car seqs))
                  (self (map1 cdr seqs)))))
       seqs)))

(def subseq (seq start (o end (len seq)))
  (if (isa seq 'string)
      (let s2 ""
        (for i start (- end 1)
          (= s2 (+ s2 (seq i))))
        s2)
      (firstn (- end start) (nthcdr start seq))))

(def copy (x)
  (case (type x)
    sym    x
    cons   (apply (fn args args) x)
    string (subseq x 0)
    table  (let new (table)
             (ontable k v x 
               (= (new k) v))
             new)
           (err "Can't copy " x)))
