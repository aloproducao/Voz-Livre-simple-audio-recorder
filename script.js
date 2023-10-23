let selectedMic = null;
let chunks = [];
let mediaRecorder = null;
let audioContext;
let analyser;
let dataArray;
let source;
let recordingInterval = null;
let recordingSeconds = 0;

document
  .getElementById("microphoneSelect")
  .addEventListener("change", (event) => {
    selectedMic = event.target.value;
  });

document
  .getElementById("recordButton")
  .addEventListener("click", startRecording);
document.getElementById("stopButton").addEventListener("click", stopRecording);

function startAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function populateMicrophoneList() {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    let micSelect = document.getElementById("microphoneSelect");
    micSelect.innerHTML = ""; // Limpa a lista atual de dispositivos
    devices.forEach((device, index) => {
      if (device.kind === "audioinput") {
        let option = document.createElement("option");
        option.value = device.deviceId;
        option.innerText =
          device.label || "Microfone " + (micSelect.length + 1);
        micSelect.appendChild(option);

        // Define o primeiro microfone como o padrão
        if (index === 0) {
          selectedMic = device.deviceId;
          micSelect.value = selectedMic;
        }
      }
    });
  });
}

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    console.log("Permissão ao microfone concedida");
    populateMicrophoneList(); // Atualiza a lista de dispositivos após a permissão ser concedida
  })
  .catch((err) => {
    console.error("Acesso ao microfone foi negado:", err);
  });

function saveRecording(blob) {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let request = store.add(blob);

  request.onsuccess = function (event) {
    listRecordings();
  };
}

function startRecording() {
  startAudioContext();

  if (!selectedMic) return;

  let noiseReduction = document.getElementById("noiseReduction").checked;
  let echoCancellation = document.getElementById("echoCancellation").checked;

  let constraints = {
    audio: {
      deviceId: selectedMic,
      noiseSuppression: noiseReduction,
      echoCancellation: echoCancellation,
    },
  };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    mediaRecorder = new MediaRecorder(stream);
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    mediaRecorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      let blob = new Blob(chunks, { type: "audio/wav" });
      saveRecording(blob);
      chunks = [];
    };

    mediaRecorder.start();
    recordingSeconds = 0;
    recordingInterval = setInterval(updateRecordingDuration, 1000); // Inicie o contador

    updateVUMeter();

    document.getElementById("recordButton").disabled = true;
    document.getElementById("stopButton").disabled = false;
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    document.getElementById("recordButton").disabled = false;
    document.getElementById("stopButton").disabled = true;
    clearInterval(recordingInterval); // Pare o contador
  }
}

function updateRecordingDuration() {
  recordingSeconds++;
  let minutes = Math.floor(recordingSeconds / 60);
  let seconds = recordingSeconds % 60;
  document.getElementById("recordingDuration").textContent = `${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateVUMeter() {
  requestAnimationFrame(updateVUMeter);

  // Pega os dados de frequência
  analyser.getByteFrequencyData(dataArray);

  let values = dataArray.reduce((acc, value) => acc + value, 0);
  let average = values / dataArray.length;

  // Converte o valor médio para dB
  let dBValue = 20 * Math.log10(average);
  let normalizedValue = Math.max(0, (dBValue + 100) / 100);

  document.getElementById("vuMeter").style.height = normalizedValue * 50 + "%";
}

// Configurando o IndexedDB
let db;
let request = indexedDB.open("audioRecordings", 1);

request.onerror = function (event) {
  console.error("Erro ao abrir o banco de dados.", event);
};

request.onsuccess = function (event) {
  db = event.target.result;
  listRecordings();
};

request.onupgradeneeded = function (event) {
  let db = event.target.result;
  if (!db.objectStoreNames.contains("recordings")) {
    db.createObjectStore("recordings", { autoIncrement: true });
  }
};

function listRecordings() {
  let recordingsList = document.getElementById("recordingsList");
  recordingsList.innerHTML = "";

  let transaction = db.transaction(["recordings"], "readonly");
  let store = transaction.objectStore("recordings");
  let cursorRequest = store.openCursor();

  let lastItem; // Variável para armazenar o último item

  cursorRequest.onsuccess = function (event) {
    let cursor = event.target.result;
    if (cursor) {
      let recording = cursor.value;
      let id = cursor.key;

      let listItem = document.createElement("tr");

      let nameCell = document.createElement("td");
      nameCell.textContent = "recording" + id + ".wav";
      listItem.appendChild(nameCell);

      let actionCell = document.createElement("td");
      let playButton = document.createElement("button");
      let stopButton = document.createElement("button");
      let downloadButton = document.createElement("button");
      let deleteButton = document.createElement("button");

      playButton.textContent = "▶️";
      playButton.className =
        "border border-gray-300 text-gray-300 hover:bg-gray-700 mr-2 px-2 py-1 rounded";
      stopButton.textContent = "⏹️";
      stopButton.className =
        "border border-gray-300 text-gray-300 hover:bg-gray-700 mr-2 px-2 py-1 rounded";
      downloadButton.textContent = "Baixar";
      downloadButton.className =
        "border border-gray-300 text-gray-300 hover:bg-gray-700 mr-2 px-2 py-1 rounded";
      deleteButton.textContent = "❌";
      deleteButton.className =
        "border border-gray-300 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded";

      let audio;

      playButton.addEventListener("click", () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio = new Audio(URL.createObjectURL(recording));
        playButton.disabled = true;
        playButton.textContent = "Reproduzindo...";
        audio.onended = function () {
          playButton.disabled = false;
          playButton.textContent = "Reproduzir";
        };
        audio.play();
      });

      stopButton.addEventListener("click", () => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
          playButton.disabled = false;
          playButton.textContent = "Reproduzir";
        }
      });

      downloadButton.addEventListener("click", () => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(recording);
        a.download = "recording" + id + ".wav";
        a.click();
      });

      deleteButton.addEventListener("click", () => {
        deleteRecording(id);
      });

      actionCell.appendChild(playButton);
      actionCell.appendChild(stopButton);
      actionCell.appendChild(downloadButton);
      actionCell.appendChild(deleteButton);
      listItem.appendChild(actionCell);

      recordingsList.appendChild(listItem);

      lastItem = listItem; // Atualize o último item

      cursor.continue();
    } else {
      // Depois que todos os itens forem listados, destaque o último item
      if (lastItem) {
        lastItem.classList.add("recent-item");
      }
    }
  };
}

document
  .getElementById("deleteAllButton")
  .addEventListener("click", deleteAllRecordings);

function deleteAllRecordings() {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let request = store.clear();

  request.onsuccess = function (event) {
    listRecordings();
  };
}

function deleteRecording(id) {
  let transaction = db.transaction(["recordings"], "readwrite");
  let store = transaction.objectStore("recordings");
  let getRequest = store.get(id);

  getRequest.onsuccess = function (event) {
    if (getRequest.result) {
      let deleteRequest = store.delete(id);

      deleteRequest.onsuccess = function (event) {
        listRecordings();
      };
    } else {
      console.error("Item não encontrado para o ID:", id);
    }
  };
}
