# Modelos das Músicas

- `msd-musicnn/`: MusiCNN treinado no Million Song Dataset (50 tags), do Essentia (Music Technology Group, UPF),
  em TensorFlow.js. Licença CC BY-NC-ND 4.0 (uso não comercial, sem modificação): o Órbita é um app pessoal, sem venda.
  Baixado pelo workflow manual "Modelo de gêneros (Músicas)" (`tools/musicas/baixar_modelo.py`; o zip do servidor vem
  sem diretório central). Saídas usadas: `model/Sigmoid` (as 50 notas) e `model/dense/Relu` (embedding de 200).
  Citação: Alonso-Jiménez, Bogdanov, Pons, Serra. TensorFlow Audio Models in Essentia. ICASSP 2020.
- `../essentia/`: Essentia.js 0.1.3 (AGPL-3.0), só para as bandas de mel do MusiCNN (`TensorflowInputMusiCNN`).
- `../tf.min.js` e `../tfjs-wasm/`: TensorFlow.js 4.22.0 e o backend WASM (Apache-2.0).
